import {Module} from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import {PersonCabinetController} from './person-cabinet.controller.js';
import {PersonCabinetService} from './person-cabinet.service.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'data-export',
    }),
  ],
  controllers: [PersonCabinetController],
  providers: [PersonCabinetService]
})
export class PersonCabinetModule {}
