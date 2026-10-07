import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach } from "vitest";
import { closeDatabase } from "@/lib/db/indexed-db";

beforeEach(() => {
  // A fresh in-memory database for every test.
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDatabase();
});
