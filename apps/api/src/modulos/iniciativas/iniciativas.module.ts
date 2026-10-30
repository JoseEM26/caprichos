import { Module } from '@nestjs/common';
import { IniciativasController } from './iniciativas.controller';
import { IniciativasService } from './iniciativas.service';
import { ArchivosModule } from '../archivos/archivos.module';

@Module({
  imports: [ArchivosModule],
  controllers: [IniciativasController],
  providers: [IniciativasService],
  exports: [IniciativasService],
})
export class IniciativasModule {}
