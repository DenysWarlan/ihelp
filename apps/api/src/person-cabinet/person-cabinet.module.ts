import { Module } from '@nestjs/common';

import { PersonCabinetController } from './person-cabinet.controller.js';
import { PersonCabinetService } from './person-cabinet.service.js';

@Module({
  controllers: [PersonCabinetController],
  providers: [PersonCabinetService],
})
export class PersonCabinetModule {}
