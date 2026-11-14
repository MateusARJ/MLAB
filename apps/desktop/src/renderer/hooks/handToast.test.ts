import { describe, it, expect } from 'vitest';
import { clearHandToastOnLower, clearHandToastOnParticipants, type HandToast } from './handToast';

describe('handToast - limpeza do aviso de mão levantada (031)', () => {
  const toastA: HandToast = {
    participant_id: 'part-a',
    name: 'Aluno A',
    student_id: '20241TADS0001',
    timestamp: 1000,
  };

  describe('clearHandToastOnLower (RF-3103, RF-3104, RF-3106)', () => {
    it('remove o aviso quando a mão abaixada é a do aviso', () => {
      expect(clearHandToastOnLower(toastA, 'part-a')).toBeNull();
    });

    it('mantém o mesmo aviso quando a mão abaixada é de outro aluno', () => {
      expect(clearHandToastOnLower(toastA, 'part-b')).toBe(toastA);
    });

    it('continua sem aviso quando não há aviso', () => {
      expect(clearHandToastOnLower(null, 'part-a')).toBeNull();
    });
  });

  describe('clearHandToastOnParticipants (RF-3105, RF-3106)', () => {
    it('remove o aviso quando o aluno saiu da sala', () => {
      const participants = [{ participant_id: 'part-b', hand_raised: true }];
      expect(clearHandToastOnParticipants(toastA, participants)).toBeNull();
    });

    it('remove o aviso quando o aluno está de mão abaixada', () => {
      const participants = [
        { participant_id: 'part-a', hand_raised: false },
        { participant_id: 'part-b', hand_raised: true },
      ];
      expect(clearHandToastOnParticipants(toastA, participants)).toBeNull();
    });

    it('remove o aviso quando o aluno vem sem o campo hand_raised', () => {
      expect(clearHandToastOnParticipants(toastA, [{ participant_id: 'part-a' }])).toBeNull();
    });

    it('mantém o mesmo aviso quando o aluno continua de mão levantada', () => {
      const participants = [
        { participant_id: 'part-a', hand_raised: true },
        { participant_id: 'part-b', hand_raised: false },
      ];
      expect(clearHandToastOnParticipants(toastA, participants)).toBe(toastA);
    });

    it('continua sem aviso quando não há aviso', () => {
      expect(clearHandToastOnParticipants(null, [])).toBeNull();
    });
  });
});
