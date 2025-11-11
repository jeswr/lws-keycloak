import { Request, Response } from 'express';
import { StorageBackend } from '../storage/storage-backend.js';
import { StorageError } from '../middleware/error-handler.js';

export class CRUDHandlers {
  constructor(private storage: StorageBackend) {}

  async handleGet(req: Request, res: Response): Promise<void> {
    try {
      const resourcePath = req.path;
      const result = await this.storage.read(resourcePath);

      if (!result) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Resource not found' });
        return;
      }

      res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
      if (result.etag) {
        res.setHeader('ETag', result.etag);
      }
      if (result.lastModified) {
        res.setHeader('Last-Modified', result.lastModified.toUTCString());
      }

      res.send(result.data);
    } catch (error) {
      throw new StorageError(
        `Failed to read resource: ${(error as Error).message}`,
        'READ_FAILED',
        500
      );
    }
  }

  async handleHead(req: Request, res: Response): Promise<void> {
    try {
      const resourcePath = req.path;
      const result = await this.storage.read(resourcePath);

      if (!result) {
        res.status(404).end();
        return;
      }

      res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
      res.setHeader('Content-Length', result.data.length);
      if (result.etag) {
        res.setHeader('ETag', result.etag);
      }
      if (result.lastModified) {
        res.setHeader('Last-Modified', result.lastModified.toUTCString());
      }

      res.status(200).end();
    } catch (error) {
      throw new StorageError(
        `Failed to get resource metadata: ${(error as Error).message}`,
        'HEAD_FAILED',
        500
      );
    }
  }

  async handlePut(req: Request, res: Response): Promise<void> {
    try {
      const resourcePath = req.path;
      const contentType = req.get('Content-Type') || 'application/octet-stream';
      const data = req.body as Buffer;

      const existed = await this.storage.exists(resourcePath);
      
      await this.storage.write(resourcePath, data, contentType);

      res.status(existed ? 200 : 201).json({
        message: existed ? 'Resource updated' : 'Resource created',
        path: resourcePath,
      });
    } catch (error) {
      throw new StorageError(
        `Failed to write resource: ${(error as Error).message}`,
        'WRITE_FAILED',
        500
      );
    }
  }

  async handlePost(req: Request, res: Response): Promise<void> {
    try {
      const containerPath = req.path;
      const contentType = req.get('Content-Type') || 'application/octet-stream';
      const data = req.body as Buffer;
      const slug = req.get('Slug');

      const resourcePath = await this.storage.create(
        containerPath,
        data,
        contentType,
        slug
      );

      res.setHeader('Location', resourcePath);
      res.status(201).json({
        message: 'Resource created',
        path: resourcePath,
      });
    } catch (error) {
      throw new StorageError(
        `Failed to create resource: ${(error as Error).message}`,
        'CREATE_FAILED',
        500
      );
    }
  }

  async handlePatch(req: Request, res: Response): Promise<void> {
    try {
      const resourcePath = req.path;
      const contentType = req.get('Content-Type') || 'application/octet-stream';
      const data = req.body as Buffer;

      const existed = await this.storage.exists(resourcePath);
      
      if (!existed) {
        // Create new resource
        await this.storage.write(resourcePath, data, contentType);
        res.status(201).json({
          message: 'Resource created',
          path: resourcePath,
        });
      } else {
        // Append to existing resource
        await this.storage.append(resourcePath, data);
        res.status(200).json({
          message: 'Resource updated',
          path: resourcePath,
        });
      }
    } catch (error) {
      throw new StorageError(
        `Failed to patch resource: ${(error as Error).message}`,
        'PATCH_FAILED',
        500
      );
    }
  }

  async handleDelete(req: Request, res: Response): Promise<void> {
    try {
      const resourcePath = req.path;
      const existed = await this.storage.exists(resourcePath);

      if (!existed) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Resource not found' });
        return;
      }

      await this.storage.delete(resourcePath);

      res.status(200).json({
        message: 'Resource deleted',
        path: resourcePath,
      });
    } catch (error) {
      throw new StorageError(
        `Failed to delete resource: ${(error as Error).message}`,
        'DELETE_FAILED',
        500
      );
    }
  }

  async handleOptions(req: Request, res: Response): Promise<void> {
    res.setHeader('Allow', 'GET, HEAD, PUT, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Slug');
    res.status(204).end();
  }
}
