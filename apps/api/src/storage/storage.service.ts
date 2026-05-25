import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

import {
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  PRESIGNED_URL_EXPIRY,
} from './storage.const.js';
import type { UploadResult, PresignedUrlResult } from './storage.model.js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(private readonly config: ConfigService) {
    this.endpoint = this.config.getOrThrow<string>('S3_ENDPOINT');
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');

    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.config.getOrThrow<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.config.getOrThrow<string>('S3_SECRET_KEY');

    this.s3 = new S3Client({
      endpoint: this.endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true, // Required for MinIO; harmless for AWS S3
    });

    this.logger.log(`Storage service configured for bucket "${this.bucket}" at ${this.endpoint}`);
  }

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size ${file.size} exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`,
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      throw new BadRequestException(
        `MIME type "${file.mimetype}" is not allowed. Accepted types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const ext = file.originalname.split('.').pop() ?? '';
    const key = ext ? `${uuidv4()}.${ext}` : uuidv4();

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    this.logger.log(`Uploaded file "${file.originalname}" as key "${key}"`);

    return {
      key,
      bucket: this.bucket,
      url: `${this.endpoint}/${this.bucket}/${key}`,
    };
  }

  async getPresignedUrl(key: string): Promise<PresignedUrlResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const url = await getSignedUrl(this.s3, command, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    return { url, expiresIn: PRESIGNED_URL_EXPIRY };
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.log(`Deleted object with key "${key}"`);
  }
}
