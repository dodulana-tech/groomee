declare module "prisma/config" {
  export function defineConfig<T>(config: T): T;
  export function env(key: string): string;
}
