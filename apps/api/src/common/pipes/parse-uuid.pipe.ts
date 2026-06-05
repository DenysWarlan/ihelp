import { BadRequestException, PipeTransform } from '@nestjs/common';

import { UUID_FORMAT } from './uuid.const.js';

export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID_FORMAT.test(value)) {
      throw new BadRequestException('Validation failed (uuid format expected)');
    }
    return value;
  }
}
