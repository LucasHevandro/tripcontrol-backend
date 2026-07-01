import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // disponível em qualquer módulo sem importar explicitamente
@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule { }