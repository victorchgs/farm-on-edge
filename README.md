# Farm On Edge: Arquitetura FIK3s

Este repositório contém a implementação de referência e a documentação técnica do Trabalho de Conclusão de Curso (TCC) em Engenharia de Computação, intitulado **"Viabilidade de uma Arquitetura de MLOps em Borda com K3s e FIWARE em Dispositivos IoT"**.

O projeto propõe a **FIK3s**, uma arquitetura de computação em borda híbrida e acessível, projetada para a orquestração de pipelines de _Machine Learning_ em locais com conectividade instável.

### Sobre a Documentação

O guia a seguir apresenta o passo a passo completo para a replicação da infraestrutura em um cluster de Raspberry Pis. Ele cobre desde a preparação do sistema operacional e instalação do orquestrador **K3s**, até a configuração da pilha de dados (**FIWARE Orion**, **MongoDB**, **MinIO**) e o deploy dos microsserviços de ML e monitoramento.

---

<details><summary>Visão Geral da Arquitetura</summary>

### **Introdução**

Este documento detalha a arquitetura e o processo de implantação da infraestrutura para o projeto "Farm On Edge". O objetivo é criar um sistema de ponta a ponta para o monitoramento de armadilhas de insetos, utilizando um cluster Kubernetes (**K3s**) robusto e autônomo que opera diretamente no local (na "borda" ou "edge"), usando dispositivos acessíveis como o Raspberry Pi.

### **Componentes Principais**

- **Cluster de Processamento:** O coração do sistema, formado por um conjunto de Raspberry Pis. Um deles atua como **nó mestre** (o cérebro que gerencia o cluster) e os outros como **nós de trabalho** (os "braços" que executam as tarefas de processamento). A configuração utiliza 1x Raspberry Pi 4 como mestre, 3x Raspberry Pi 4 como trabalhadores e 1x Raspberry Pi 3 como trabalhador adicional.
- **Pilha de Serviços:** Para garantir a operação autônoma, os serviços de base são executados no nó mestre, que possui maior capacidade de armazenamento. A arquitetura adota uma abordagem híbrida para a gestão desses serviços:
  - **Gerenciados via Docker Compose:** A pilha de dados (**FIWARE Orion** e **MongoDB**) e o **Registro de Contêineres Local** rodam via Docker Compose para uma gestão simples e isolada.
  - **Gerenciados via Kubernetes:** O **MinIO Object Storage** e o serviço **Watcher** são implantados como recursos do Kubernetes, fixados no nó mestre através de regras de agendamento. Isso permite uma integração de rede mais profunda e uma gestão unificada com o restante das aplicações.
- **Aplicações Orquestradas:** A aplicação de processamento (`processor`) é executada como Jobs do Kubernetes. Sua configuração é injetada via **`ConfigMap` e `Secrets`**, garantindo uma separação segura entre a lógica da aplicação e as credenciais de acesso. Isso permite que o processamento pesado de imagens seja distribuído de forma segura e resiliente entre os nós de trabalho disponíveis.
- **Pilha de Monitoramento (Híbrida):** Para garantir a observabilidade do sistema, uma pilha com **Prometheus**, **Grafana** e **Node Exporter** é implantada no cluster. O Prometheus coleta as métricas localmente e as envia para uma instância na nuvem (Grafana Cloud), permitindo tanto a visualização local quanto a centralizada.
- **Dashboard Web (Local):** Uma aplicação front-end moderna, desenvolvida em React/Vite, é implantada no cluster para servir como a interface de usuário principal na rede local. Ela se conecta ao FIWARE Orion para exibir os dados das armadilhas e ao Grafana local para mostrar a saúde do cluster.

### **Como Tudo se Conecta: O Fluxo de Dados**

O fluxo de uma imagem do início ao fim demonstra a interação entre os componentes:

1. **Captura:** Um dispositivo de borda (ex: Raspberry Pi Zero) em uma armadilha captura uma imagem.
2. **Armazenamento:** A imagem é enviada pela rede local e salva no **MinIO**.
3. **Detecção (Polling Inteligente):** Periodicamente (a cada 30 segundos), o serviço **`watcher`** varre o bucket do MinIO em busca de novos arquivos.
4. **Análise:** O `watcher` encontra a nova imagem, pois ela ainda não possui o metadado `status: processed`.
5. **Criação da Tarefa:** O watcher solicita a criação de um Job no Kubernetes. Somente após receber a confirmação da API de que a tarefa foi aceita com sucesso, ele adiciona o metadado `status: processed` ao objeto no MinIO. Essa ordem garante que a marcação de "processado" só ocorra para imagens que de fato tiveram seu processamento iniciado.
6. **Execução:** O Kubernetes agenda essa tarefa em um dos **nós de trabalho** disponíveis, que baixa a aplicação **`processor`** do Registro Local.
7. **Processamento:** A aplicação `processor` é executada, baixa a imagem do MinIO, roda os modelos de Machine Learning e gera os resultados.
8. **Armazenamento de Resultados:** O `processor` envia os resultados para o **FIWARE Orion**, que os armazena no MongoDB.
9. **Backup na Nuvem:** Simultaneamente, o MinIO pode ser configurado para replicar a imagem para um backup na nuvem, e o `processor` para enviar os resultados para um banco de dados na nuvem.

### **Estrutura Final do Repositório**

Todos os arquivos de configuração e código-fonte são estruturados no repositório Git `farm-on-edge`.

```latex
farm-on-edge/
├── apps/
│   ├── processor/
│   │   ├── models/
│   │   │   ├── clf/
│   │   │   │   └── model_mobilenet_mlp.keras
│   │   │   │
│   │   │   └── count/
│   │   │       ├── mlp_regression_aug.keras
│   │   │       └── model_unet_aug_cp.keras
│   │   │
│   │   ├── src/
│   │   │   ├── utils/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── classifier.py
│   │   │   │   ├── counting.py
│   │   │   │   └── pre_process.py
│   │   │   │
│   │   │   ├── __init__.py
│   │   │   └── main.py
│   │   │
│   │   ├── Dockerfile
│   │   ├── image_processing_pipeline.py
│   │   └── pyproject.toml
│   │
│   └── watcher/
│       ├── Dockerfile
│       ├── requirements.txt
│       └── watcher.py
│
├── dashboard/
│   ├── public/
│   ├── src/
│   ├── .env.example
│   ├── Dockerfile
│   └── ... (outros arquivos do projeto Vite)
│
├── edge-device/
│   └── upload_image.py
│
├── kubernetes/
│   ├── atlas-secret.yaml.template
│   ├── aws-credentials-secret.yaml.template
│   ├── dashboard-deployment.yaml
│   ├── external-services.yaml
│   ├── grafana-cloud-secret.yaml.template
│   ├── grafana-deployment.yaml
│   ├── image-puller-ds.yaml
│   ├── ingress-rules.yaml
│   ├── job-template.yaml
│   ├── minio-stack.yaml
│   ├── mirror-config.yaml.template
│   ├── mirror-deployment.yaml
│   ├── node-exporter-ds.yaml
│   ├── prometheus-config.yaml.template
│   ├── prometheus-deployment.yaml
│   └── watcher-deployment.yaml
│
├── master-services/
│   ├── .env.example
│   └── docker-compose.yml
│
├── .gitignore
└── README.md
```

</details>
<details><summary>Fase 1: Preparação e Configuração dos Nós (Mestre e Trabalhadores)</summary>

### **Objetivo**

Preparar todos os cinco Raspberry Pis do cluster. Este processo abrange a gravação do sistema operacional nos cartões micro SD com configurações de rede e usuário pré-definidas, a realização do primeiro boot, a configuração de endereços de IP estáticos para cada nó e a atualização do sistema, deixando-o pronto para a instalação do K3s.

### **Pré-requisitos**

- **Hardware:**
  - 4x Raspberry Pi 4
  - 1x Raspberry Pi 3
  - 1x Cartão Micro SD de 64 GB (para o nó mestre)
  - 4x Cartões Micro SD de 16 GB ou superior (para os nós trabalhadores)
  - 5x Fontes de alimentação adequadas para os Raspberry Pis
  - 1x Computador (Windows, macOS ou Linux)
  - 1x Adaptador de cartões micro SD para USB
- **Software:**
  - [Raspberry Pi Imager](https://www.raspberrypi.com/software/) instalado no computador

### **Procedimento**

### **1.1. Visão Geral do Cluster e Planejamento de Rede**

A identidade de cada nó na rede será definida conforme a tabela abaixo. Este planejamento é crucial para a estabilidade do cluster.
| Papel no Cluster | Hardware | Nome de Anfitrião (`hostname`) | Endereço IP Estático |
| ---------------- | -------------- | ------------------------------ | -------------------- |
| **Mestre** | Raspberry Pi 4 | `master` | `192.168.1.200` |
| Worker | Raspberry Pi 4 | `worker-01` | `192.168.1.201` |
| Worker | Raspberry Pi 4 | `worker-02` | `192.168.1.202` |
| Worker | Raspberry Pi 4 | `worker-03` | `192.168.1.203` |
| Worker | Raspberry Pi 3 | `worker-04` | `192.168.1.204` |
_Nota: Certifique-se de que essa faixa de IPs (`192.168.1.200` a `192.168.1.204`) está livre na sua rede._

### **1.2. Gravação dos Cartões Micro SD com Raspberry Pi Imager**

Execute o processo a seguir individualmente para cada um dos 5 cartões micro SD. Comece pelo cartão do nó mestre.

1. Insira o cartão micro SD no adaptador e conecte-o ao seu computador.
2. Abra o software **Raspberry Pi Imager** e faça as seguintes seleções na tela principal:
   - **Dispositivo Raspberry Pi:** Clique em `ESCOLHER DISPOSITIVO` e selecione o modelo do nó (ex: `Raspberry Pi 4`).
   - **Sistema Operacional:** Clique em `ESCOLHER SO` e selecione `Raspberry Pi OS (64-bit)`.
   - **Armazenamento:** Clique em `ESCOLHER ARMAZENAMENTO` e selecione o drive correspondente ao seu cartão micro SD.
3. Após preencher os três campos, clique em `SEGUINTE` e, na janela de diálogo, clique em `EDITAR CONFIGURAÇÕES`.
4. No painel de personalização, preencha as abas:
   - **Aba GERAL:**
     - Na seção `Definir o nome de anfitrião`, marque a caixa e digite o nome correspondente da tabela na seção 1.1 (ex: `master`).
     - Na seção `Definir nome de utilizador e palavra-passe`, preencha os dados:
       - **Nome de utilizador:** `farmonedge`
       - **Palavra-passe:** `root`
         _(Aviso de Segurança: Para um ambiente de produção, use senhas complexas e únicas.)_
     - Na seção `Configurar a rede LAN sem fios`, marque a caixa e preencha os dados:
       - **SSID:** O nome da sua rede Wi-Fi.
       - **Palavra-passe:** A senha da sua rede Wi-Fi.
         _(Aviso: O Raspberry Pi 3 não reconhece redes de 5 GHz. Garanta que todos os dispositivos estejam na mesma rede de 2,4 GHz ou em rede cabeada.)_
     - Na seção `Definir definições de idioma e região`, preencha os dados da sua região:
       - Fuso horário: `America/Fortaleza`;
       - Disposição do teclado: `br`.
   - **Aba SERVIÇOS:**
     - Marque a opção `Ativar SSH`;
     - Selecione `Utilizar autenticação por palavra-passe`.
5. Clique em **`SALVAR`** e depois em **`SIM`** para iniciar a gravação.
6. Aguarde a gravação finalizar e repita o processo para os outros quatro cartões, ajustando o `Dispositivo`, o `Armazenamento` e o `Nome de anfitrião` conforme a tabela.

### **1.3. Primeiro Boot e Configuração Final do Sistema**

Execute os passos a seguir em cada um dos 5 nós.

1. **Inicialização:** Insira cada cartão SD em seu respectivo Raspberry Pi e conecte a energia. Aguarde 2-3 minutos para o boot.
2. **Conexão Remota (SSH):** No seu computador, conecte-se a cada nó. Por exemplo, para o mestre:

   ```bash
   ssh farmonedge@master.local
   ```

   Na primeira conexão, digite `yes` para aceitar a chave e depois a senha `root`.

3. **Configuração do IP Estático:** Use a ferramenta `nmtui`.

   1. Inicie a ferramenta:

      ```bash
      sudo nmtui
      ```

   2. Use as setas para selecionar `Edit a connection` e pressione Enter.
   3. Selecione a interface da rede ativa e pressione Enter.
   4. Mude a `IPv4 CONFIGURATION` de `<Automatic>` para `<Manual>` e expanda as opções em `<Show>`.
   5. Preencha os campos:
      - **Addresses:** Adicione o IP do nó seguido de `/24` (ex: `192.168.1.200/24`).
      - **Gateway:** Adicione o IP do seu roteador (ex: `192.168.1.1`).
      - **DNS servers:** Repita o IP do seu roteador adicionado no **Gateway**, adicione um segundo campo e preencha-o com o DNS do Google `8.8.8.8`.
   6. Selecione `<OK>` para salvar, e `<Back>` e `<Quit>` para sair.

4. **Atualização e Preparação do Kernel:**

   - Atualize todos os pacotes do sistema:
     ```bash
     sudo apt update && sudo apt full-upgrade -y
     ```
   - Habilite os `cgroups` de memória, um requisito do K3s:

     1. Abra o arquivo de boot:

        ```bash
        sudo nano /boot/firmware/cmdline.txt
        ```

     2. Vá até o final da única linha, adicione um espaço e cole:

        ```latex
        cgroup_memory=1 cgroup_enable=memory
        ```

     3. Salve o arquivo (`Ctrl+X`, `Y`, `Enter`).

5. **Reinicialização Final:** Reinicie todos os nós para aplicar as configurações.

   ```bash
   sudo reboot
   ```

   Após a reinicialização, conecte-se novamente usando os novos endereços de IP estáticos que você configurou.

---

Ao final desta fase, todos os cinco nós do cluster estão ativos na rede com IPs fixos, atualizados e com a base do sistema pronta para a instalação do K3s na próxima fase.

</details>
<details><summary>Fase 2: Implantação do Cluster K3s</summary>
### **Objetivo**
Instalar o software de orquestração K3s no nó mestre, configurar o mestre para ser um gerenciador exclusivo (não executando cargas de trabalho) e unir os quatro nós de trabalho para formar um cluster funcional e estável.
### **Pré-requisitos**
- Fase 1 concluída com sucesso.
- Todos os 5 nós do cluster devem estar ligados, na mesma rede e acessíveis via SSH através de seus IPs estáticos.
- Múltiplas janelas de terminal abertas no seu computador para gerenciar os nós simultaneamente.
### **Procedimento**
### **2.1. Instalação do Servidor K3s (Nó Mestre)**
Execute os passos a seguir apenas no terminal conectado ao **nó mestre**.
1. **Conecte-se ao nó mestre** via SSH:

```bash
ssh farmonedge@192.168.1.200
```

2. **Execute o script de instalação oficial do K3s.** Este script detecta o sistema e instala a versão estável mais recente do servidor K3s:

   ```bash
   curl -sfL https://get.k3s.io | sh -s -
   ```

3. **Verifique se o serviço K3s está rodando:**

   ```bash
   sudo systemctl status k3s
   ```

   Confirme se a saída inclui uma linha verde com `active (running)`. Pressione a tecla `q` para sair da tela de status.

### **2.2. Obtenção das Credenciais de Conexão**

Ainda no nó mestre, obtenha o token secreto que permitirá aos workers se juntarem ao cluster.

1. **Exiba o token de conexão:**

   ```bash
   sudo cat /var/lib/rancher/k3s/server/node-token
   ```

2. **Copie a longa string de texto exibida** (ex: `K10...::server:abc...`). É fundamental guardar este token em um local seguro, como um bloco de notas, pois ele será usado em todos os nós de trabalho.

### **2.3. Instalação dos Agentes K3s (Nós de Trabalho)**

Execute os passos a seguir em cada um dos quatro nós de trabalho.

1. **Abra um terminal para cada worker** e conecte-se a eles via SSH. Exemplo para o `worker-01`:

   ```bash
   ssh farmonedge@192.168.1.201
   ```

2. **Execute o script de instalação do agente** em cada um dos quatro terminais. Substitua `<SEU_TOKEN_AQUI>` pelo token que você copiou do mestre:

   ```bash
   curl -sfL https://get.k3s.io | K3S_URL=https://192.168.1.200:6443 K3S_TOKEN="<SEU_TOKEN_AQUI>" sh -
   ```

### **2.4. Verificação e Validação do Cluster**

Volte ao terminal do nó mestre para realizar a verificação final da saúde do cluster.

1. **Liste os nós do cluster:** Aguarde um ou dois minutos e execute o comando abaixo.

   ```bash
   sudo kubectl get nodes -o wide
   ```

   **Cenário de Sucesso:** A saída deve ser uma tabela listando os 5 nós do cluster (1 `master`, 4 workers), todos com o `STATUS` **`Ready`**.

   ```latex
   NAME        STATUS   ROLES                  AGE     VERSION        INTERNAL-IP     EXTERNAL-IP   OS-IMAGE                       KERNEL-VERSION   CONTAINER-RUNTIME
   master      Ready    control-plane,master   5m      v1.33.5+k3s1   192.168.1.200   <none>        Debian GNU/Linux 13 (trixie)     ...              containerd://...
   worker-01   Ready    <none>                 1m      v1.33.5+k3s1   192.168.1.201   <none>        Debian GNU/Linux 13 (trixie)     ...              containerd://...
   worker-02   Ready    <none>                 1m15s   v1.33.5+k3s1   192.168.1.202   <none>        Debian GNU/Linux 13 (trixie)     ...              containerd://...
   worker-03   Ready    <none>                 1m30s   v1.33.5+k3s1   192.168.1.203   <none>        Debian GNU/Linux 13 (trixie)     ...              containerd://...
   worker-04   Ready    <none>                 2m      v1.33.5+k3s1   192.168.1.204   <none>        Debian GNU/Linux 13 (trixie)     ...              containerd://...
   ```

2. **Isole o nó mestre:** Aplique um "taint" (marcação) no mestre. Esta ação impede o Kubernetes de agendar pods de aplicação nele, reservando seus recursos para as tarefas de gerenciamento.

   ```bash
   sudo kubectl taint nodes master node-role.kubernetes.io/control-plane=true:NoSchedule
   ```

   A saída esperada é `node/master tainted`.

3. **Verifique se a marcação foi aplicada com sucesso:**

   ```bash
   sudo kubectl describe node master | grep Taints
   ```

   A saída deve confirmar a aplicação da regra:

   `Taints:             node-role.kubernetes.io/control-plane=true:NoSchedule`

---

Ao final desta fase, o cluster Kubernetes está totalmente funcional com cinco nós. O mestre está isolado para atuar apenas como gerenciador, e os quatro workers estão prontos para executar as cargas de trabalho do projeto.

</details>

<details><summary>Fase 3: Implantação da Pilha de Serviços no Nó Mestre</summary>

### **Objetivo**

Implantar a infraestrutura de serviços de base no nó mestre. Este processo utiliza uma abordagem híbrida, onde serviços essenciais como MinIO são gerenciados pelo Kubernetes para garantir a alocação correta de recursos, enquanto a pilha de dados (FIWARE/MongoDB) e o Registro de Contêineres rodam via Docker Compose para uma gestão simplificada.

### **Pré-requisitos**

- Fase 2 concluída com sucesso, com o cluster K3s funcional.
- Uma sessão SSH ativa para o nó mestre (`192.168.1.200`).

### **Procedimento**

### **3.1. Instalação e Configuração do Docker**

1. **Instale as dependências necessárias**, incluindo `git` e `jq`:

   ```bash
   sudo apt-get update
   sudo apt-get install ca-certificates curl git jq -y
   ```

2. **Adicione o repositório oficial do Docker:**

   ```bash
   sudo install -m 0755 -d /etc/apt/keyrings
   sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
   sudo chmod a+r /etc/apt/keyrings/docker.asc

   echo \
     "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
     $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
     sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt-get update
   ```

3. **Instale os pacotes do Docker Engine e do Docker Compose:**

   ```bash
   sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
   ```

4. **Configure o Docker Daemon:** Crie o arquivo de configuração para que o Docker confie no registro local (`insecure-registries`) e use um DNS robusto.

   ```bash
   sudo nano /etc/docker/daemon.json
   ```

   Cole o seguinte conteúdo e salve:

   ```json
   {
     "insecure-registries": ["192.168.1.200:5000"]
   }
   ```

5. **Reinicie e configure o Docker para iniciar com o sistema:**

   ```bash
   sudo systemctl restart docker
   sudo systemctl enable docker
   sudo usermod -aG docker $USER
   ```

   **IMPORTANTE:** Saia da sessão SSH e conecte-se novamente (`exit`, depois `ssh farmonedge@192.168.1.200`).

### **3.2. Build da Imagem FIWARE Orion (Compilação Local)**

Compile a imagem do FIWARE Orion diretamente no dispositivo para garantir a compatibilidade com o hardware do Raspberry Pi.

1. **Clone o repositório oficial do FIWARE Orion:**

   ```bash
   cd ~
   git clone https://github.com/telefonicaid/fiware-orion.git
   ```

2. **Navegue até a pasta do Docker e construa a imagem.** Este processo é demorado (pode levar mais de 30 minutos).

   ```bash
   cd fiware-orion/docker
   docker build -t orion .
   ```

### **3.3. Obtenção dos Arquivos de Configuração do Projeto**

Clone o repositório `farm-on-edge` para obter todos os manifestos e arquivos de configuração.

```bash
cd ~
git clone https://github.com/victorchgs/farm-on-edge.git farm-on-edge
```

### **3.4. Implantação dos Serviços via Kubernetes**

1. **Etiquete o Nó Mestre:** Aplique uma etiqueta ao nó mestre para que o Kubernetes agende serviços específicos nele.

   ```bash
   sudo kubectl label node master node-role=master --overwrite
   ```

2. **Implante a Pilha MinIO:** Navegue até a pasta de manifestos e aplique o arquivo `minio-stack.yaml`.

   ```bash
   cd ~/farm-on-edge/kubernetes
   sudo kubectl apply -f minio-stack.yaml
   ```

### **3.5. Preparação da Configuração dos Serviços**

Crie um arquivo de ambiente (`.env`) que conterá a configuração de CORS para o FIWARE Orion.

1. **Navegue até o diretório de serviços:**

   ```bash
   cd ~/farm-on-edge/master-services
   ```

2. **Crie o arquivo `.env` a partir do template:**

   ```bash
   cp .env.example .env
   ```

3. Preencha a variável com o IP do nó mestre.

### **3.6. Iniciando os Serviços via Docker Compose**

1. **Navegue até o diretório de serviços** do Docker Compose:

   ```bash
   cd ~/farm-on-edge/master-services
   ```

2. **Inicie a pilha de dados** (FIWARE, MongoDB) e o Registro:

   ```bash
   docker compose up -d
   ```

3. **Verifique o status** para confirmar que os contêineres estão rodando:

   ```bash
   docker compose ps
   ```

   **Cenário de Sucesso:** A saída deve mostrar os três serviços (`orion`, `mongo`, `registry`) com o status `running` ou `healthy`.

   ```latex
   NAME                         IMAGE          SERVICE     STATUS              PORTS
   master-services-mongo-1      mongo:4.4.18   mongo       running (healthy)   27017/tcp
   master-services-orion-1      orion:latest   orion       running             0.0.0.0:1026->1026/tcp
   master-services-registry-1   registry:2     registry    running             0.0.0.0:5000->5000/tcp
   ```

### **3.7. Configuração do Registro Local no K3s**

Execute este procedimento para que todos os nós do cluster confiem no registro local.

1. Nos **4 nós de trabalho (workers)**, primeiro crie o diretório de configuração:

   ```bash
   sudo mkdir -p /etc/rancher/k3s
   ```

2. Agora, em **TODOS os 5 nós** (mestre e workers), crie e edite o arquivo `registries.yaml`:

   ```bash
   sudo nano /etc/rancher/k3s/registries.yaml
   ```

   Adicione o seguinte conteúdo e salve:

   ```yaml
   mirrors:
     "192.168.1.200:5000":
       endpoint:
         - "http://192.168.1.200:5000"
   ```

3. **Reinicie os serviços K3s** para aplicar a nova configuração:
   - **No nó mestre:**
     ```bash
     sudo systemctl restart k3s
     ```
   - **Em cada um dos 4 nós de trabalho:**
     ```bash
     sudo systemctl restart k3s-agent
     ```

### **3.8. Verificação Final de Todos os Serviços**

1. **Verifique os pods do Kubernetes:** Confirme que o MinIO está rodando **no nó mestre**.

   ```bash
   sudo kubectl get pods -o wide -l app=minio
   ```

   **Saída Esperada (exemplo):**

   ```latex
   NAME                      READY   STATUS    RESTARTS   AGE   IP           NODE     NOMINATED NODE   READINESS GATES
   minio-5495697c58-4pm4r    1/1     Running   0          10m   10.42.0.10   master   <none>           <none>
   ```

2. **Verifique o FIWARE:** Confirme que o serviço está no ar.

   ```bash
   curl -s 'http://localhost:1026/version' | jq .
   ```

   **Saída Esperada (exemplo):**

   ```json
   {
     "orion": {
       "version": "...",
       "uptime": "...",
       "git_hash": "...",
       "compile_time": "...",
       "compiled_by": "root",
       "compiled_in": "buildkitsandbox",
       "release_date": "...",
       "machine": "aarch64",
       "doc": "https://fiware-orion.rtfd.io/"
     }
   }
   ```

3. **Verifique a Conexão FIWARE <> MongoDB:** Confirme que o Orion acessa o banco.

   ```bash
   curl -s 'http://localhost:1026/v2/entities' | jq .
   ```

   **Saída Esperada:** `[]`

4. **Verifique e Configure o MinIO:**

   - **Verifique a API e Crie o Bucket via Linha de Comando:**

     1. Instale o cliente MinIO (`mc`):

        ```bash
        wget https://dl.min.io/client/mc/release/linux-arm64/mc && chmod +x mc && sudo mv mc /usr/local/bin/
        ```

     2. **Configure o "alias"** para se conectar ao servidor MinIO local:

        ```bash
        mc alias set local http://localhost:9000 farmonedge farmonedge
        ```

     3. Crie o bucket `insect-images`:

        ```bash
        mc mb local/insect-images
        ```

     4. **Liste os buckets** para verificar a conexão e a criação do bucket:

        ```bash
        mc ls local
        ```

        **Saída Esperada:** A lista deve conter o bucket que você criou.

        `[2025-09-30 14:20:00 BRT]     0B insect-images/`

     5. **Crie a Regra de Ciclo de Vida (Limpeza Automática):**
        - Execute o seguinte comando para que o MinIO apague automaticamente imagens processadas com mais de 30 dias.
          ```bash
          mc ilm rule add local/insect-images --expiry-days "30" --tags "status=processed"
          ```
        - **Para confirmar que a regra foi criada, execute:**
          ```bash
          mc ilm rule ls local/insect-images
          ```

---

Ao final desta fase, toda a infraestrutura de serviços de borda está operacional, com componentes gerenciados tanto pelo Kubernetes quanto pelo Docker Compose, pronta para as próximas etapas.

</details>

<details><summary>Fase 4: Aplicação de Processamento (Processor): Build e Registro Local</summary>

### **Objetivo**

Empacotar a aplicação de Machine Learning completa em uma imagem Docker e publicá-la no Registro de Contêineres Local privado do cluster, deixando-a pronta para ser orquestrada pelo K3s.

### **Pré-requisitos**

- Fase 3 concluída, com a pilha de serviços (MinIO, FIWARE, etc.) em execução e o repositório do projeto clonado na pasta `~/farm-on-edge` do nó mestre.
- O Docker Daemon no nó mestre já está configurado para confiar no registro local (configurado na Fase 3).
- Arquivos de modelo (`.keras`) baixados no computador local do usuário.

### **Procedimento**

### **4.1. Provisionamento dos Modelos de ML**

Transfira os arquivos de modelo de Machine Learning do seu computador local para a estrutura de pastas correta no nó mestre.

1. Execute os seguintes comandos para criar as pastas para armazenar os modelos:

   ```bash
   mkdir -p ~/farm-on-edge/apps/processor/models/clf
   mkdir -p ~/farm-on-edge/apps/processor/models/count
   ```

2. No **seu computador local**, abra um terminal (ou PowerShell).
3. Navegue até a pasta onde você salvou os três arquivos `.keras`.
4. Execute os comandos `scp` abaixo para copiar cada modelo para o seu destino:
   - **Modelo de Classificação:**
     ```bash
     scp model_mobilenet_mlp.keras farmonedge@192.168.1.200:~/farm-on-edge/apps/processor/models/clf/
     ```
   - **Modelo de Segmentação:**
     ```bash
     scp model_unet_aug_cp.keras farmonedge@192.168.1.200:~/farm-on-edge/apps/processor/models/count/
     ```
   - **Modelo de Regressão:**
     ```bash
     scp mlp_regression_aug.keras farmonedge@192.168.1.200:~/farm-on-edge/apps/processor/models/count/
     ```

### **4.2. Build da Imagem Docker no Nó Mestre**

Execute os passos a seguir na sua sessão SSH com o **nó mestre**.

1. Navegue até o diretório da aplicação `processor`:

   ```bash
   cd ~/farm-on-edge/apps/processor
   ```

2. Execute o comando de build. A tag (`t`) deve apontar para o registro local. Este processo pode ser **muito demorado** na primeira vez, pois irá baixar o TensorFlow.

   ```bash
   docker build -t 192.168.1.200:5000/farmonedge-processor:latest .
   ```

### **4.3. Push para o Registro Local**

Envie a imagem recém-construída para o seu registro privado, tornando-a disponível para todo o cluster.

```bash
docker push 192.168.1.200:5000/farmonedge-processor:latest
```

### **4.4. Verificação do Registro**

Confirme que a imagem foi enviada com sucesso.

```bash
curl -X GET http://192.168.1.200:5000/v2/_catalog
```

A saída esperada é um JSON contendo o nome da sua imagem:
`{"repositories":["farmonedge-processor"]}`

### **4.5. (Recomendado) Pré-aquecimento do Cache de Imagens**

A imagem do `processor` é muito grande. Para evitar uma longa espera no primeiro `Job`, force todos os nós a baixarem a imagem antecipadamente.

1. **Aplique o manifesto do `DaemonSet`** para iniciar o download em todos os nós:

   ```bash
   cd ~/farm-on-edge/kubernetes
   sudo kubectl apply -f image-puller-ds.yaml
   ```

2. **Monitore o progresso**. Aguarde até que todos os pods `image-puller-...` atinjam o status `Running`.

   ```bash
   sudo kubectl get pods -o wide
   ```

   **Cenário de Sucesso (exemplo):** A saída mostrará um pod `image-puller` para cada nó.

   ```latex
   NAME                 READY   STATUS              RESTARTS   AGE   IP           NODE        NOMINATED NODE
   image-puller-2795z   0/1     ContainerCreating   0          9s    <none>       master      <none>
   image-puller-jsqkl   0/1     ContainerCreating   0          9s    <none>       worker-01   <none>
   image-puller-6hfbw   0/1     ContainerCreating   0          9s    <none>       worker-02   <none>
   image-puller-abcde   0/1     ContainerCreating   0          9s    <none>       worker-03   <none>
   image-puller-4tts6   0/1     ContainerCreating   0          9s    <none>       worker-04   <none>
   ```

3. **Remova o `DaemonSet`** após a conclusão dos downloads.

   ```bash
   sudo kubectl delete daemonset image-puller
   ```

---

Ao final desta fase, a aplicação `processor` está empacotada e disponível para todo o cluster através do registro local, pronta para ser usada na fase de automação.

</details>

<details><summary>Fase 5: Serviço de Automação (Watcher): Build e Implantação no K3s</summary>

### **Objetivo**

Construir a imagem Docker do serviço de automação `watcher` e implantá-la no cluster Kubernetes. O serviço finalizado irá verificar periodicamente (`polling`) o bucket do MinIO em busca de imagens não processadas e criar `Jobs` de processamento para cada uma delas.

### **Pré-requisitos**

- Fase 4 concluída, com a imagem `farmonedge-processor:latest` disponível no registro local.
- Repositório `farm-on-edge` clonado no nó mestre na pasta `~/farm-on-edge`.
- Sessão SSH ativa para o nó mestre.

### **Procedimento**

### **5.1. Preparação das Configurações do Job**

Antes de implantar o `watcher`, precisamos registrar no cluster as configurações que ele usará para criar os Jobs de processamento. Isso inclui um `Secret` para futuras credenciais de nuvem e um `ConfigMap` para o template do Job.

- **Criação do Segredo Placeholder**
  Para garantir que nossa aplicação esteja pronta para a futura integração com a nuvem, vamos criar um `Secret` com um valor temporário. A aplicação `processor` é inteligente o suficiente para ignorar o envio para a nuvem se a credencial não for real.

  1. Na sua sessão SSH com o nó mestre, navegue até a pasta de manifestos:

     ```bash
     cd ~/farm-on-edge/kubernetes
     ```

  2. Crie seu arquivo de segredos do Atlas a partir do template:

     ```bash
     cp atlas-secret.yaml.template atlas-secret.yaml
     ```

  3. **Não altere o arquivo `atlas.secret.yaml` por enquanto.** Deixe os valores de exemplo.
  4. **Aplique este segredo "placeholder" no cluster:**

     ```bash
     sudo kubectl apply -f atlas-secret.yaml
     ```

- **Criação do ConfigMap do Template**
  Agora, armazene o `job-template.yaml` como um `ConfigMap`. Este template já referencia o `Secret` que acabamos de criar. Ainda na pasta `kubernetes`, execute o comando para criar ou atualizar o `ConfigMap`:
  ```bash
  sudo kubectl create configmap job-template-config --from-file=job-template.yaml -o yaml --dry-run=client | sudo kubectl apply -f -
  ```

### **5.2. Build e Push da Imagem do Watcher**

Construa a imagem Docker para o serviço `watcher` e envie-a para o registro local.

1. Navegue até o diretório da aplicação `watcher`:

   ```bash
   cd ~/farm-on-edge/apps/watcher
   ```

2. Construa a imagem Docker:

   ```bash
   docker build -t 192.168.1.200:5000/farmonedge-watcher:latest .
   ```

3. Envie a imagem para o Registro Local:

   ```bash
   docker push 192.168.1.200:5000/farmonedge-watcher:latest
   ```

### **5.3. Implantação do Watcher no K3s**

Com a imagem do `watcher` disponível no registro, implante-o no cluster.

1. **Navegue de volta para a pasta de manifestos:**

   ```bash
   cd ~/farm-on-edge/kubernetes
   ```

2. **Aplique o manifesto de implantação:** Este comando criará os recursos de permissão (RBAC) e o `Deployment` necessários para executar o `watcher`.

   ```bash
   sudo kubectl apply -f watcher-deployment.yaml
   ```

### **5.4. Verificação do Serviço Watcher**

Verifique se o pod do `watcher` foi implantado e está rodando corretamente.

1. Liste os pods para encontrar o novo pod do `watcher`:

   ```bash
   sudo kubectl get pods -l app=watcher
   ```

   Aguarde até que o `STATUS` do pod seja `Running`.

2. Verifique os logs de inicialização do serviço:

   ```bash
   sudo kubectl logs deployment/watcher -f
   ```

   **Cenário de Sucesso:** A saída deve mostrar os logs de inicialização do script de polling, indicando que ele está no ar e monitorando o bucket.

   ```latex
   --- Iniciando Serviço MinIO Watcher (modo Polling Inteligente) ---
   Cliente Kubernetes configurado com sucesso (in-cluster).
   Conectado ao MinIO. Monitorando bucket: 'insect-images'
   ```

---

Ao final desta fase, o serviço de automação `watcher` está implantado, executando sua lógica de verificação periódica e pronto para acionar o pipeline de processamento.

</details>

<details><summary>Fase 6: Validação do Fluxo de Ponta a Ponta</summary>

### **Objetivo**

Realizar um teste completo e sistemático de toda a arquitetura autônoma para validar que o upload de uma imagem no MinIO é detectado pelo serviço `watcher`, que por sua vez cria um `Job` no Kubernetes para executar o `processor`, com os resultados sendo finalmente persistidos no FIWARE.

### **Pré-requisitos**

- Todas as fases anteriores (1 a 5) foram concluídas com sucesso.
- O `Deployment` do `watcher` está no estado `Running` no cluster.
- Um arquivo de imagem de teste (ex: `.jpg`) está disponível no computador local do usuário.
- (Recomendado) O cache da imagem do `processor` foi pré-aquecido nos nós.

### **Procedimento**

### **6.1. Preparar o Ambiente de Monitoramento**

Abra três janelas de terminal distintas. Em cada uma, conecte-se via SSH ao seu nó mestre (`192.168.1.200`). Cada terminal terá uma função específica durante o teste.

- **Terminal 1 - Logs do Watcher:**
  Monitore os logs do `watcher` em tempo real para ver a detecção da imagem.
  `bash
sudo kubectl logs deployment/watcher -f
`
- **Terminal 2 - Status dos Pods:**
  Observe o ciclo de vida do pod de processamento.
  `bash
sudo kubectl get pods -w
`
- **Terminal 3 - Comandos de Verificação:**
  Use este terminal para executar os comandos de inspeção após a conclusão do processo.

### **6.2. Acionar o Pipeline (Upload da Imagem)**

Inicie o fluxo completo enviando uma nova imagem para o sistema.

1. No seu computador, abra um navegador e acesse a interface web do MinIO: `http://192.168.1.200:9001`
2. Faça login com as credenciais corretas (usuário: `farmonedge`, senha: `farmonedge`).
3. Navegue até o bucket `insect-images`.
4. **Crie a "pasta" da fazenda:**
   - Crie uma pasta no seu computador com o nome do `FARM_ID` do seu teste. Por exemplo: `FAZENDA-BOA-VISTA`.
   - **Faça o upload da pasta no MinIO:**
     - Clique no botão **"Upload"** e selecione a pasta de teste.
     - **IMPORTANTE:** O nome do arquivo em si deve seguir o padrão `TRAP-ID_qualquercoisa.jpg`. Por exemplo: `TRAP-VALIDATION-01_teste.jpg`.

### **6.3. Observar a Automação em Tempo Real**

Com o upload concluído, observe a cadeia de eventos nos terminais preparados.

1. **No Terminal 1 (Logs do Watcher):** Dentro do próximo ciclo de verificação (até 30 segundos), o `watcher` detectará o novo arquivo e iniciará o processo. As mensagens de log serão:

   ```latex
   Novo objeto (não processado) detectado: TRAP-VALIDATION-01_test.jpg
   Job 'proc-job-...' criado com sucesso para a imagem 'TRAP-VALIDATION-01_test.jpg'.
   Metadado 'processed' adicionado com sucesso ao objeto: TRAP-VALIDATION-01_test.jpg
   ```

2. **No Terminal 2 (Status dos Pods):** Um novo pod com o prefixo `proc-job-` aparecerá. Observe seu status mudar:
   - `Pending` -> `ContainerCreating` -> `Running` -> `Completed`
   - _Nota: Se o cache de imagens foi pré-aquecido na Fase 4, a etapa `ContainerCreating` será muito rápida (poucos segundos)._

### **6.4. Verificar os Resultados Finais**

Quando o pod no Terminal 2 atingir o status `Completed`, use o Terminal 3 para a verificação final dos dados.

1.  **Verificar os Logs do Processador:**
    - Copie o nome completo do pod que foi concluído (visível no Terminal 2) e armazene-o em uma variável:
      ```bash
      POD_NAME=<cole_o_nome_completo_do_pod_aqui>
      ```
    - Exiba os logs daquele pod:
      ```bash
      sudo kubectl logs $POD_NAME
      ```
    - **O que procurar:** A saída deve mostrar as mensagens do script `processor` por exemplo `"Modelos executados. Resultados: ..."` e `"Nova leitura criada com sucesso."`.
      _Nota: Nesta fase, é **esperado e normal** que apareça uma mensagem de aviso informando que a string de conexão do Atlas não foi configurada._
2.  **Verificar os Dados no FIWARE:**
    Consulte a API do Orion para verificar as entidades que foram criadas/atualizadas. - **1. Verifique a entidade principal da armadilha:**
    `bash
curl -s -X GET "http://localhost:1026/v2/entities/urn:ngsi-ld:InsectTrap:FAZENDA-BOA-VISTA:TRAP-VALIDATION-01" -H "Accept: application/json" | jq .
`

                                            *(Confirme que os atributos `last_reading_at` e `last_insect_count` foram atualizados).*

                                        - **2. Verifique a entidade de leitura histórica:**

                                            ```bash
                                            curl -s -G "http://localhost:1026/v2/entities" --data-urlencode "type=InsectReading" --data-urlencode "q=refInsectTrap=='urn:ngsi-ld:InsectTrap:FAZENDA-BOA-VISTA:TRAP-VALIDATION-01'" -H "Accept: application/json" | jq .
                                            ```

                                            *(O resultado esperado é um array JSON contendo pelo menos um objeto do tipo `InsectReading`).*

---

Ao final desta fase, a arquitetura de ponta a ponta está validada como funcional, autônoma e reativa.

</details>

<details><summary>Fase 7: Habilitando a Arquitetura Híbrida (Borda + Nuvem)</summary>

### **Objetivo**

Conectar o cluster de borda a serviços de nuvem para criar um backup seguro das imagens capturadas (usando AWS S3) e centralizar os metadados de processamento (usando MongoDB Atlas), preparando o sistema para acesso global.

### **Pré-requisitos**

- Todas as fases de 1 a 6 foram concluídas.
- O repositório `farm-on-edge` está clonado no nó mestre.
- Uma conta ativa na AWS (Amazon Web Services).
- Uma conta ativa no MongoDB Atlas.

### **Procedimento**

### **7.1. Configuração do Banco de Dados Centralizado (MongoDB Atlas)**

Acesse sua conta no MongoDB Atlas e crie um cluster na nuvem para servir como o banco de dados central para os resultados do processamento.

1. **Crie um Cluster Gratuito:**
   - No painel do MongoDB Atlas, crie um novo projeto e inicie a criação de um cluster.
   - Selecione a opção “Free” e dê um nome ao cluster (ex: `farmonedge-cluster`).
   - Escolha um provedor de nuvem de sua preferência e a região mais próxima da sua (ex: AWS, na região `sa-east-1` - São Paulo).
2. **Crie um Usuário de Acesso:**
   - No menu seguinte, coloque um nome de usuário (ex: `farmonedge_user`), e **copie a senha para um local seguro**.
   - Crie o novo usuário.
3. **Obtenha a String de Conexão:**
   - Em seguida, no menu de “Connect your application” clique em **"Drivers"**.
   - Selecione o driver **"Python"** e copie a string de conexão. Edite-a para incluir a **senha** que você salvou.
   - **Guarde esta string de conexão final.**
   - **Exemplo Final:**
     ```latex
     mongodb+srv://farmonedge_user:SUA_SENHA_AQUI@farmonedge-cluster.xxxx.mongodb.net/?retryWrites=true&w=majority&appName=farmonedge-cluster
     ```
4. **Libere o Acesso de Rede:**
   - Acesse **"Network Access"** e adicione uma nova regra de acesso, selecionando **"ALLOW ACCESS FROM ANYWHERE", que vai adicionar o ip** `0.0.0.0/0`.

### **7.2. Configuração do Backup de Imagens (AWS S3)**

Acesse sua conta AWS e crie um bucket para servir como backup de longo prazo para as imagens.

1. **Crie um Bucket S3:**
   - No console da AWS, garanta que está na mesma região selecionada no MongoDB Atlas (ex: `sa-east-1`), acesse o serviço **S3** e crie um novo bucket.
   - Dê um nome globalmente único (ex: `farmonedge-images-backup-id`).
   - Em **"Versionamento de bucket"** selecione **"Ativar".**
   - Em **"Configurações de bloqueio do acesso público deste bucket"** mantenha a opção **"Bloquear *todo* o acesso público"** ativada.
   - Crie o bucket.
2. **Crie um Usuário IAM para a Replicação:**
   - Acesse o serviço **IAM** e crie um novo usuário (ex: `farmonedge-minio-replicator`).
   - Na etapa de permissões, escolha **"Anexar políticas diretamente"** e clique em **"Criar política"**.
   - No editor de políticas, vá para a guia **JSON** e cole o seguinte código, substituindo `<SEU-NOME-DE-BUCKET-AQUI>` pelo nome exato do seu bucket:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "s3:ListBucket",
             "s3:GetBucketLocation",
             "s3:GetBucketVersioning",
             "s3:GetReplicationConfiguration",
             "s3:PutReplicationConfiguration"
           ],
           "Resource": "arn:aws:s3:::<SEU-NOME-DE-BUCKET-AQUI>"
         },
         {
           "Effect": "Allow",
           "Action": [
             "s3:PutObject",
             "s3:GetObject",
             "s3:DeleteObject",
             "s3:ReplicateObject",
             "s3:ReplicateTags"
           ],
           "Resource": "arn:aws:s3:::<SEU-NOME-DE-BUCKET-AQUI>/*"
         }
       ]
     }
     ```
   - Dê um nome à política (ex: `FarmOnEdge-MinIO-Replication-Policy`), salve-a e anexe-a ao usuário que está sendo criado, e finalize a criação do usuário.
3. **Gere as Chaves de Acesso:**
   - Após criar o usuário, acesse sua página, vá para a guia **"Credenciais de segurança"** e crie uma **"Chave de acesso"**.
   - Selecione o caso de uso **"Aplicação executada fora da AWS"**.
   - **Copie e guarde em local seguro o `Access key ID` e o `Secret access key`**.

### **7.3. Preparação dos Arquivos de Configuração e Segredos**

No nó mestre, os arquivos de configuração específicos para esta fazenda são criados a partir dos templates genéricos do repositório.

1. **Acesse a pasta de manifestos:**

   ```bash
   cd ~/farm-on-edge/kubernetes
   ```

2. **Crie e Preencha o Segredo do MongoDB Atlas:**

   ```bash
   cp atlas-secret.yaml.template atlas-secret.yaml
   nano atlas-secret.yaml
   ```

   (Dentro do editor, cole sua string de conexão completa do Atlas.)

3. **Crie e Preencha o Segredo de Credenciais da AWS:**

   ```bash
   cp aws-credentials-secret.yaml.template aws-credentials-secret.yaml
   nano aws-credentials-secret.yaml
   ```

   (Dentro do editor, cole suas chaves de acesso da AWS.)

4. **Crie e Preencha a Configuração do `mirror`:**

   ```bash
   cp mirror-config.yaml.template mirror-config.yaml
   nano mirror-config.yaml
   ```

   (Dentro do editor, cole o nome do seu bucket S3.)

### **7.4. Aplicação das Configurações no Cluster**

Com os arquivos locais preenchidos, os `Secrets` e o `ConfigMap` são aplicados ao cluster, seguidos pela implantação do serviço de espelhamento (`mirror`).

1. **Aplique os segredos e a configuração:**

   ```bash
   sudo kubectl apply -f atlas-secret.yaml
   sudo kubectl apply -f aws-credentials-secret.yaml
   sudo kubectl apply -f mirror-config.yaml
   ```

2. **Implante o Serviço de Espelhamento (`mirror`):**

   ```bash
   sudo kubectl apply -f mirror-deployment.yaml
   ```

### **7.5. Validação do Fluxo Híbrido Completo**

1. **Verifique os Pods:** Aguarde o novo pod `minio-s3-mirror-...` entrar no estado `Running`.

   ```bash
   sudo kubectl get pods -w
   ```

2. **Acione o Pipeline Completo:** Faça o upload de uma nova imagem de teste no bucket `insect-images` do seu MinIO local.
3. **Verifique Todos os Pontos de Persistência:**
   - [ ] **FIWARE Local:** Use `curl` para confirmar que a nova leitura foi criada no Orion local.
   - [ ] **MongoDB Atlas:** No "Browse Collections" do Atlas, confirme que o novo documento JSON apareceu na coleção `readings`.
   - [ ] **AWS S3:** No console da AWS, confirme que o arquivo de imagem foi replicado com sucesso para o seu bucket S3.

---

Ao final desta fase, o sistema de borda está totalmente integrado à nuvem, transformando-se em uma arquitetura híbrida robusta, com backup de imagens no S3 e centralização de metadados no MongoDB Atlas.

</details>

<details><summary>Fase 8: Implantação da Pilha de Monitoramento Híbrido</summary>

### **Objetivo**

Implantar uma pilha de monitoramento completa (Prometheus, Grafana e Node Exporter) para obter visibilidade da saúde e do desempenho do cluster de borda. A implementação abrange tanto a operação local autônoma quanto a análise consolidada em uma plataforma centralizada na nuvem (Grafana Cloud).

### **Pré-requisitos**

- Todas as fases de 1 a 7 foram concluídas.
- O repositório `farm-on-edge` está clonado no nó mestre.
- Uma conta ativa no Grafana Cloud.

### **Procedimento**

### **8.1. Obtenção das Credenciais do Grafana Cloud**

As credenciais para o `remote_write` são obtidas no portal do Grafana Cloud, seguindo o fluxo de configuração para conectar uma fonte de dados externa do Prometheus.

1. **Acesse o Portal e Inicie a Configuração:**
   - Faça login na sua conta em [grafana.com](https://grafana.com/) e, no painel principal, clique no nome da sua "stack" para abrir a visão geral.
   - Na página de visão geral, localize e clique na caixa intitulada **"Prometheus Metrics"**.
   - Na seção "**How do you want to get started?**", selecione a opção **"Connect and enhance an existing Prometheus instance"**.
   - Na seção "**What do you want to do with your Prometheus Data?**", selecione a opção **"Send metrics to Grafana Cloud"**.
   - Na seção "**How do you want to connect your Prometheus data to Grafana Cloud?**", selecione a opção **"Prometheus Remote Write"**.
2. **Defina o Cenário de Uso e Gere as Credenciais:**
   - A tela final ("**Hosted Prometheus metrics**") apresentará várias opções. Faça as seguintes seleções:
     - Em "**Choose a method for forwarding metrics**", selecione **"From my local Prometheus server"**.
     - Em "**Choose your use case for forwarding metrics**", selecione **"Send metrics from a single Prometheus instance"**.
     - Em "**Select how to send the metrics..."**, selecione **"Directly"**.
   - Na seção "**Update Prometheus configuration**", você encontrará as credenciais:
     - Na sub-seção **"Use an API token"**:
       - No campo **"Token name"**, digite um nome descritivo para a sua chave (ex: `farmonedge-k3s-token`).
       - Clique no botão **"Create token"**.
     - Após clicar, a página será atualizada, e um trecho de código YAML aparecerá, contendo as credenciais. **Copie as três informações essenciais** deste trecho:
       1. A **`url`**.
       2. O **`username`**.
       3. A **`password`** (a chave de API recém-gerada).
     - Guarde estas três informações em um local seguro para usar na próxima etapa.

### **8.2. Preparação dos Arquivos de Configuração e Segredos**

No nó mestre, os arquivos de configuração específicos para o cluster são criados a partir dos templates genéricos do repositório.

1.  **Acesse a pasta de manifestos:**

    ```bash
    cd ~/farm-on-edge/kubernetes
    ```

2.  **Crie e Preencha o Segredo do Grafana Cloud:**
    Copie o template e edite o novo arquivo para inserir suas credenciais.
    `bash
cp grafana-cloud-secret.yaml.template grafana-cloud-secret.yaml
nano grafana-cloud-secret.yaml
`

                                              (Dentro do editor, cole seu `username` e `API Key` do Grafana Cloud.)

3.  **Crie e Preencha a Configuração do Prometheus:**
    Copie o template e edite o novo arquivo para inserir o `farm_id` e as credenciais novamente.
    `bash
cp prometheus-config.yaml.template prometheus-config.yaml
nano prometheus-config.yaml
`

                                              (Dentro do editor, preencha todos os placeholders `<...>` com os valores reais: `farm_id`, `URL`, `username` e `password`.)

### **8.3. Implantação da Pilha de Monitoramento no Cluster**

Com os arquivos locais prontos, todos os manifestos são aplicados ao cluster.

1. **Aplique o segredo:**

   ```bash
   sudo kubectl apply -f grafana-cloud-secret.yaml
   ```

2. **Aplique os manifestos da pilha de monitoramento:**

   ```bash
   sudo kubectl apply -f prometheus-config.yaml
   sudo kubectl apply -f prometheus-deployment.yaml
   sudo kubectl apply -f grafana-deployment.yaml
   sudo kubectl apply -f node-exporter-ds.yaml
   ```

### **8.4. Verificação da Implantação**

1. **Monitore os pods** com `sudo kubectl get pods -w` e aguarde até que `prometheus`, `grafana` e todos os `node-exporter`s estejam no estado `Running`.
2. **Verifique os Alvos do Prometheus:**
   - Exponha a porta do Prometheus:
     ```bash
     sudo kubectl port-forward deployment/prometheus 9090:9090 --address 0.0.0.0
     ```
   - Acesse `http://192.168.1.200:9090` e, no menu **"Status" -> "Targets"**, confirme que todos os alvos estão **UP** (verdes).

### **8.5. Configuração e Validação Final**

1. **Acesse e Configure o Grafana Local:**
   - Acesse `http://192.168.1.200:3000` (login: `admin`/`admin`).
   - No menu ⚙️ -> "Data Sources", adicione a fonte de dados "Prometheus" com a URL `http://prometheus:9090` e teste.
2. **Importe um Dashboard:**
   - No menu "Dashboards", crie uma nova dashboard e selecione a opção "Import a dashboard". Use o ID de um dashboard de Kubernetes (ex: `15757`).
   - Selecione sua fonte de dados "Prometheus" e importe.
3. **Valide na Nuvem:**
   - Acesse sua conta do Grafana Cloud e vá em "Explore".
   - Execute a consulta `up{farm_id="SEU_ID_DE_FAZENDA"}` (usando o `farm_id` que você configurou). Se a consulta retornar dados, o `remote_write` está funcionando.

---

Ao final desta fase, a arquitetura de monitoramento híbrido está completa, com visibilidade local e centralizada da saúde e do desempenho de todos os componentes do cluster.

</details>

<details><summary>Fase 9: Implantação do Dashboard Web</summary>

### **Objetivo**

Implantar a aplicação web completa, que consiste em um **serviço de backend** para a lógica de API e um **serviço de frontend** para a interface do usuário. Ambos rodarão como contêineres no nó mestre, provendo a interface de monitoramento na rede local.

### **Pré-requisitos**

- Todas as fases de 1 a 8 foram concluídas.
- O repositório `farm-on-edge` está clonado e atualizado no nó mestre.

### **Procedimento**

### **9.1. Preparação dos Ambientes de Build**

É necessário configurar os ambientes para que tanto o backend quanto o frontend sejam construídos para o modo de operação local (borda).

1.  **Prepare o Backend:**Bash

         - Crie o segredo para a assinatura do JWT. No diretório `~/farm-on-edge/kubernetes`, execute:

         `cp jwt-secret.yaml.template jwt-secret.yaml

    nano jwt-secret.yaml # <-- Insira sua string secreta longa`

2.  **Prepare o Frontend:**Bash

         - Acesse a pasta do dashboard: `cd ~/farm-on-edge/dashboard`.
         - Crie o arquivo `.env` a partir do template e configure-o para o modo local:

         `cp .env.example .env

    echo 'VITE_APP_ENV="local"' > .env
    echo 'LOCAL_USER="admin"' >> .env
    echo 'LOCAL_PASSWORD="admin"' >> .env`

### **9.2. Build e Push das Imagens Docker**

Agora, construímos e enviamos as imagens para ambos os serviços.

1.  **Construa e Envie a Imagem do Backend (API):**Bash

         `cd ~/farm-on-edge/dashboard/server

    docker build -t 192.168.1.200:5000/farmonedge-dashboard-api:latest .
    docker push 192.168.1.200:5000/farmonedge-dashboard-api:latest`

2.  **Construa e Envie a Imagem do Frontend (UI):**Bash

         `cd ~/farm-on-edge/dashboard

    docker build -t 192.168.1.200:5000/farmonedge-dashboard:latest .
    docker push 192.168.1.200:5000/farmonedge-dashboard:latest`

### **9.3. Implantação dos Componentes no Cluster**

Com as imagens no registro, os manifestos do backend e do frontend são aplicados ao cluster.

1. **Acesse a pasta de manifestos:**Bash

   `cd ~/farm-on-edge/kubernetes`

2. **Aplique o Segredo do JWT:**Bash

   `sudo kubectl apply -f jwt-secret.yaml`

3. **Aplique os Manifestos de Implantação:**Bash

   `# Implanta o backend primeiro
   sudo kubectl apply -f dashboard-api-deployment.yaml

   # Implanta o frontend

   sudo kubectl apply -f dashboard-deployment.yaml`

### **9.4. Configuração de Acesso às Imagens (MinIO)**

Para que o navegador possa carregar as imagens das armadilhas, a política de acesso do bucket MinIO deve ser ajustada para permitir o download público (leitura).
Bash
`mc anonymous set download local/insect-images`

### **9.5. Verificação e Acesso Final**

1. **Monitore os Pods:** Aguarde os novos pods `dashboard-api-...` e `dashboard-...` entrarem no estado `Running`.Bash

   `sudo kubectl get pods -w`

2. **Acesse o Dashboard:**
   Quando ambos os pods estiverem `Running`, acesse a aplicação no seu navegador: - **URL:** `http://192.168.1.200:3001`

---

Ao final desta fase, a arquitetura completa do projeto "Farm On Edge" está implantada e funcional, com uma interface de usuário e um serviço de API dedicados para o monitoramento dos dados coletados na borda.

</details>
