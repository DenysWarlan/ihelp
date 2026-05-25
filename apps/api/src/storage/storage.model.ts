export interface UploadResult {
  key: string;
  bucket: string;
  url: string;
}

export interface PresignedUrlResult {
  url: string;
  expiresIn: number;
}
