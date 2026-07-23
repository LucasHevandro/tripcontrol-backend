import { BadRequestException } from '@nestjs/common';
import { SplitType } from '../generated/prisma/enums';
import { buildExpenseSplits } from './expense-splits.util';

const participants = [
  { id: 'participant-a', userId: 'user-a', sponsorId: null },
  { id: 'participant-b', userId: 'user-b', sponsorId: null },
  { id: 'participant-c', userId: 'user-c', sponsorId: null },
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

  describe('dependentes (sponsorId) na divisão igual', () => {
    // Ana (independente), Bruno + esposa (dependente de Bruno),
    // Carlos + esposa + filho (dependentes de Carlos).
    const familyParticipants = [
      { id: 'ana', userId: 'user-ana', sponsorId: null },
      { id: 'bruno', userId: 'user-bruno', sponsorId: null },
      { id: 'bruno-esposa', userId: 'user-bruno-esposa', sponsorId: 'bruno' },
      { id: 'carlos', userId: 'user-carlos', sponsorId: null },
      { id: 'carlos-esposa', userId: 'user-carlos-esposa', sponsorId: 'carlos' },
      { id: 'carlos-filho', userId: 'user-carlos-filho', sponsorId: 'carlos' },
    ];

    it('dobra os dependentes no patrocinador ao dividir igualmente entre todos', () => {
      const splits = buildExpenseSplits({
        amount: 600,
        splitType: SplitType.EQUAL,
        tripParticipants: familyParticipants,
      });

      expect(splits).toEqual([
        { participantId: 'ana', amount: 200 },
        { participantId: 'bruno', amount: 200 },
        { participantId: 'carlos', amount: 200 },
      ]);
      expect(splits.reduce((sum, split) => sum + split.amount, 0)).toBe(600);
    });

    it('trata o dependente como pagador independente se o patrocinador não estiver no rateio', () => {
      const splits = buildExpenseSplits({
        amount: 90,
        splitType: SplitType.EQUAL,
        splitParticipants: [
          { participantId: 'ana' },
          { participantId: 'bruno-esposa' },
          { participantId: 'carlos' },
        ],
        tripParticipants: familyParticipants,
      });

      expect(splits).toEqual([
        { participantId: 'ana', amount: 30 },
        { participantId: 'bruno-esposa', amount: 30 },
        { participantId: 'carlos', amount: 30 },
      ]);
    });

    it('mantém o resto do arredondamento no primeiro pagador efetivo após o fold', () => {
      const splits = buildExpenseSplits({
        amount: 100,
        splitType: SplitType.EQUAL,
        tripParticipants: familyParticipants,
      });

      expect(splits).toEqual([
        { participantId: 'ana', amount: 33.34 },
        { participantId: 'bruno', amount: 33.33 },
        { participantId: 'carlos', amount: 33.33 },
      ]);
      expect(splits.reduce((sum, split) => sum + split.amount, 0)).toBe(100);
    });
  });
});
