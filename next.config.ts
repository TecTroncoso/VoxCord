import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El cliente nativo de libSQL no se empaqueta (usa require dinámico);
  // se resuelve externamente en el servidor Node.
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
