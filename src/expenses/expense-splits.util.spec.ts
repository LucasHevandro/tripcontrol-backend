import { BadRequestException } from '@nestjs/common';
import { SplitType } from '../generated/prisma/enums';
import { buildExpenseSplits } from './expense-splits.util';

const participants = [
  { id: 'participant-a', userId: 'user-a' },
  { id: 'participant-b', userId: 'user-b' },
  { id: 'participant-c', userId: 'user-c' },
];

describe('buildExpenseSplits', () => {
  it('divide igualmente e mantém a soma igual ao total', () => {
    const splits = buildExpenseSplits({
      amount: 100,
      splitType: SplitType.EQUAL,
      tripParticipants: participants,
    });

    expect(splits).toEqual([
      { participantId: 'participant-a', amount: 33.34 },
      { participantId: 'participant-b', amount: 33.33 },
      { participantId: 'participant-c', amount: 33.33 },
    ]);
    expect(splits.reduce((sum, split) => sum + split.amount, 0)).toBe(100);
  });

  it('aceita ids de usuário na divisão customizada e converte para TripParticipant.id', () => {
    const splits = buildExpenseSplits({
      amount: 75,
      splitType: SplitType.CUSTOM,
      splitParticipants: [
        { participantId: 'user-a', amount: 25 },
        { participantId: 'user-b', amount: 50 },
      ],
      tripParticipants: participants,
    });

    expect(splits).toEqual([
      { participantId: 'participant-a', amount: 25 },
      { participantId: 'participant-b', amount: 50 },
    ]);
  });

  it('não cria splits para despesa individual', () => {
    expect(
      buildExpenseSplits({
        amount: 40,
        splitType: SplitType.INDIVIDUAL,
        tripParticipants: participants,
      }),
    ).toEqual([]);
  });

  it('rejeita participante que não pertence à viagem', () => {
    expect(() =>
      buildExpenseSplits({
        amount: 40,
        splitType: SplitType.CUSTOM,
        splitParticipants: [{ participantId: 'user-x', amount: 40 }],
        tripParticipants: participants,
      }),
    ).toThrow(BadRequestException);
  });
});
