export interface StorageResource {
  data: Buffer;
  contentType: string;
  etag?: string;
  lastModified?: Date;
}

export interface StorageBackend {
  read(path: string): Promise<StorageResource | null>;
  write(path: string, data: Buffer, contentType: string): Promise<void>;
  create(containerPath: string, data: Buffer, contentType: string, slug?: string): Promise<string>;
  append(path: string, data: Buffer): Promise<void>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
