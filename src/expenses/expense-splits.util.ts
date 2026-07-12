import { BadRequestException } from '@nestjs/common';
import { SplitType } from '../generated/prisma/enums';
import { SplitParticipantDto } from './dto/create-expense.dto';

type TripParticipantRef = {
  id: string;
  userId: string;
};

export type ExpenseSplitInput = {
  participantId: string;
  amount: number;
};

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildExpenseSplits(params: {
  amount: number;
  splitType: SplitType;
  splitParticipants?: SplitParticipantDto[];
  tripParticipants: TripParticipantRef[];
}): ExpenseSplitInput[] {
  const {
    amount,
    splitType,
    splitParticipants = [],
    tripParticipants,
  } = params;

  if (splitType === SplitType.INDIVIDUAL) {
    return [];
  }

  const participantMap = new Map(
    tripParticipants.flatMap((participant) => [
      [participant.userId, participant.id],
      [participant.id, participant.id],
    ]),
  );

  if (splitType === SplitType.EQUAL) {
    const participantIds =
      splitParticipants.length > 0
        ? splitParticipants
            .map((split) => participantMap.get(split.participantId))
            .filter((id): id is string => Boolean(id))
        : tripParticipants.map((participant) => participant.id);

    if (participantIds.length === 0) {
      throw new BadRequestException(
        'Nenhum participante válido encontrado para divisão',
      );
    }

    const amountPerPerson = roundMoney(amount / participantIds.length);
    const remainder = roundMoney(
      amount - amountPerPerson * participantIds.length,
    );

    return participantIds.map((participantId, index) => ({
      participantId,
      amount:
        index === 0 ? roundMoney(amountPerPerson + remainder) : amountPerPerson,
    }));
  }

  if (splitParticipants.length === 0) {
    throw new BadRequestException(
      'Divisão customizada requer os valores por participante',
    );
  }

  const totalSplit = splitParticipants.reduce(
    (sum, split) => sum + (split.amount ?? 0),
    0,
  );

  if (Math.abs(totalSplit - amount) > 0.01) {
    throw new BadRequestException(
      'A soma dos valores individuais deve ser igual ao total da despesa',
    );
  }

  return splitParticipants.map((split) => {
    const participantId = participantMap.get(split.participantId);

    if (!participantId) {
      throw new BadRequestException(
        'Todos os participantes da divisão precisam pertencer à viagem',
      );
    }

    return {
      participantId,
      amount: roundMoney(split.amount ?? 0),
    };
  });
}
