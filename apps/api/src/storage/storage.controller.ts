import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { StorageService } from './storage.service.js';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file to object storage' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({ description: 'File uploaded successfully' })
  @ApiBadRequestResponse({ description: 'Invalid file size or MIME type' })
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.storageService.upload(file);
  }

  @Get(':key/url')
  @ApiOperation({ summary: 'Get a presigned download URL for a stored file' })
  @ApiOkResponse({ description: 'Presigned URL generated' })
  async getPresignedUrl(@Param('key') key: string) {
    return this.storageService.getPresignedUrl(key);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a file from object storage' })
  @ApiOkResponse({ description: 'File deleted' })
  async delete(@Param('key') key: string) {
    return this.storageService.delete(key);
  }
}
