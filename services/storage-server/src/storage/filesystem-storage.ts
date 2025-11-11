import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageBackend, StorageResource } from './storage-backend.js';

export class FilesystemStorage implements StorageBackend {
  constructor(private basePath: string) {
    this.ensureBaseDirectory();
  }

  private ensureBaseDirectory() {
    if (!fsSync.existsSync(this.basePath)) {
      fsSync.mkdirSync(this.basePath, { recursive: true });
    }
  }

  private resolvePath(resourcePath: string): string {
    // Remove leading slash and normalize
    const normalizedPath = resourcePath.replace(/^\/+/, '');
    const fullPath = path.join(this.basePath, normalizedPath);

    // Security: ensure path is within basePath
    const resolvedPath = path.resolve(fullPath);
    const resolvedBase = path.resolve(this.basePath);

    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new Error('Path traversal attack detected');
    }

    return resolvedPath;
  }

  private getMetadataPath(resourcePath: string): string {
    return `${resourcePath}.metadata.json`;
  }

  async read(resourcePath: string): Promise<StorageResource | null> {
    try {
      const fullPath = this.resolvePath(resourcePath);
      const metadataPath = this.getMetadataPath(fullPath);

      // Check if file exists
      try {
        await fs.access(fullPath);
      } catch {
        return null;
      }

      const data = await fs.readFile(fullPath);
      const stats = await fs.stat(fullPath);

      // Try to read metadata
      let contentType = 'application/octet-stream';
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        contentType = metadata.contentType || contentType;
      } catch {
        // No metadata file or parse error, use default
      }

      // Generate ETag from file content
      const etag = `"${crypto.createHash('md5').update(data).digest('hex')}"`;

      return {
        data,
        contentType,
        etag,
        lastModified: stats.mtime,
      };
    } catch (error) {
      throw new Error(`Failed to read resource: ${(error as Error).message}`);
    }
  }

  async write(resourcePath: string, data: Buffer, contentType: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(resourcePath);
      const metadataPath = this.getMetadataPath(fullPath);

      // Ensure parent directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Write data
      await fs.writeFile(fullPath, data);

      // Write metadata
      const metadata = {
        contentType,
        created: new Date().toISOString(),
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      throw new Error(`Failed to write resource: ${(error as Error).message}`);
    }
  }

  async create(
    containerPath: string,
    data: Buffer,
    contentType: string,
    slug?: string
  ): Promise<string> {
    try {
      const containerFullPath = this.resolvePath(containerPath);

      // Ensure container exists
      await fs.mkdir(containerFullPath, { recursive: true });

      // Generate resource name
      const resourceName = slug || `resource-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const resourcePath = path.join(containerPath, resourceName);

      await this.write(resourcePath, data, contentType);

      return resourcePath;
    } catch (error) {
      throw new Error(`Failed to create resource: ${(error as Error).message}`);
    }
  }

  async append(resourcePath: string, data: Buffer): Promise<void> {
    try {
      const fullPath = this.resolvePath(resourcePath);

      // Append to file
      await fs.appendFile(fullPath, data);

      // Update metadata
      const metadataPath = this.getMetadataPath(fullPath);
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        metadata.modified = new Date().toISOString();
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      } catch {
        // Metadata file doesn't exist, create it
        const metadata = {
          contentType: 'application/octet-stream',
          modified: new Date().toISOString(),
        };
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      }
    } catch (error) {
      throw new Error(`Failed to append to resource: ${(error as Error).message}`);
    }
  }

  async delete(resourcePath: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(resourcePath);
      const metadataPath = this.getMetadataPath(fullPath);

      // Delete resource
      await fs.unlink(fullPath);

      // Delete metadata if exists
      try {
        await fs.unlink(metadataPath);
      } catch {
        // Metadata file might not exist
      }
    } catch (error) {
      throw new Error(`Failed to delete resource: ${(error as Error).message}`);
    }
  }

  async exists(resourcePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(resourcePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
