import { registerDecorator, ValidationOptions } from 'class-validator';

import { UUID_FORMAT } from './uuid.const.js';

export function IsUuidFormat(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isUuidFormat',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: { message: `${propertyKey as string} must be a UUID`, ...options },
      validator: { validate: (v: unknown) => typeof v === 'string' && UUID_FORMAT.test(v) },
    });
  };
}
