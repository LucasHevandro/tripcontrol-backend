import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('trips/:tripId/expenses')
export class ExpensesController {
    constructor(private expensesService: ExpensesService) { }

    @Get()
    @ApiOperation({ summary: 'Listar despesas da viagem' })
    @ApiQuery({ name: 'category', required: false })
    findAll(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
        @Query('category') category?: string,
    ) {
        return this.expensesService.findAll(user.id, tripId, category);
    }

    @Get('summary')
    @ApiOperation({ summary: 'Resumo financeiro por categoria' })
    getSummary(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
    ) {
        return this.expensesService.getSummary(user.id, tripId);
    }

    @Post()
    @ApiOperation({ summary: 'Registrar nova despesa com divisão' })
    create(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
        @Body() dto: CreateExpenseDto,
    ) {
        return this.expensesService.create(user.id, tripId, dto);
    }

    @Patch(':expenseId')
    @ApiOperation({ summary: 'Editar despesa' })
    update(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
        @Param('expenseId') expenseId: string,
        @Body() dto: UpdateExpenseDto,
    ) {
        return this.expensesService.update(user.id, tripId, expenseId, dto);
    }

    @Delete(':expenseId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Deletar despesa' })
    remove(
        @CurrentUser() user: { id: string },
        @Param('tripId') tripId: string,
        @Param('expenseId') expenseId: string,
    ) {
        return this.expensesService.remove(user.id, tripId, expenseId);
    }
}