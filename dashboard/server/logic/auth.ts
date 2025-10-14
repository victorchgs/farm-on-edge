import "dotenv/config";
import bcrypt from "bcrypt";

export const validateCredentials = async (
  email?: string,
  password?: string
): Promise<boolean> => {
  if (!email || !password) {
    return false;
  }

  if (process.env.VITE_APP_ENV === "local") {
    return (
      email === process.env.LOCAL_USER &&
      password === process.env.LOCAL_PASSWORD
    );
  } else {
    if (email === process.env.ADMIN_EMAIL) {
      return await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH!);
    }
    return false;
  }
};
