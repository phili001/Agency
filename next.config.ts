import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      // Cuanto se reutiliza una seccion precargada al pasar el raton por el
      // sidebar. Por defecto son 5 minutos: se podia entrar a una seccion y
      // ver datos de antes de un cambio hecho en otra. 30 s es el minimo.
      static: 30,
    },
  },
};

export default nextConfig;
