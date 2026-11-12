import { Module } from '@nestjs/common';
import { ChatbotModule } from '../chatbot';
import { AprendizajesController } from './aprendizajes.controller';
import { AprendizajesService } from './aprendizajes.service';
import { AprendizajesNocheService } from './aprendizajes-noche.service';
import { AprendizajesHistoricoService } from './aprendizajes-historico.service';
import { AprendizajesTarea } from './aprendizajes.tarea';

@Module({
  imports: [ChatbotModule],
  controllers: [AprendizajesController],
  providers: [AprendizajesService, AprendizajesNocheService, AprendizajesHistoricoService, AprendizajesTarea],
})
export class AprendizajesModule {}
