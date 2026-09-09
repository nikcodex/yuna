
import { AsyncLocalStorage } from "node:async_hooks";
export const localeStore = new AsyncLocalStorage<{ locale: string }>();
