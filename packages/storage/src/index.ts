import { Layer } from "effect";
import { makeStorageConnectionLayer, type StorageOptions } from "./database";
import { CacheServiceLive } from "./database";
import { RepositoryLive } from "./repositories";

export * from "./database";
export * from "./repositories";
export * from "./schema";

export const makeStorageLayer = (options: StorageOptions) =>
  Layer.merge(CacheServiceLive, RepositoryLive).pipe(
    Layer.provide(makeStorageConnectionLayer(options)),
  );
