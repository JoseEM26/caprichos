import { Module } from '@nestjs/common';
import { ChatbotModule } from '../chatbot';
import { AprendizajesController } from './aprendizajes.controller';
import { AprendizajesService } from './aprendizajes.service';
import { AprendizajesNocheService } from './aprendizajes-noche.service';
import { AprendizajesHistoricoService } from './aprendizajes-historico.service';
import { AprendizajesMejorarService } from './aprendizajes-mejorar.service';
import { AprendizajesTarea } from './aprendizajes.tarea';

@Module({
  imports: [ChatbotModule],
  controllers: [AprendizajesController],
  providers: [AprendizajesService, AprendizajesNocheService, AprendizajesHistoricoService, AprendizajesMejorarService, AprendizajesTarea],
})
export class AprendizajesModule {}
