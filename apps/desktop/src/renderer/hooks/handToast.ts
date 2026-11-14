/**
 * Regras do aviso flutuante de mão levantada no app do professor (031, RF-3103 a RF-3106).
 *
 * O aviso mostra a última mão levantada e some quando essa mão deixa de estar levantada,
 * por qualquer caminho. Eventos de outros alunos não alteram o aviso, e ele não passa a
 * mostrar a próxima mão da fila (C-3101). As funções devolvem o mesmo objeto quando nada
 * muda, para não provocar renderização à toa.
 */
export interface HandToast {
  participant_id: string;
  name: string;
  student_id?: string;
  timestamp: number;
}

export interface HandToastParticipant {
  participant_id: string;
  hand_raised?: boolean;
}

/** Mão abaixada pelo próprio aluno (`hand-updated` com `raised: false`) ou pelo professor. */
export function clearHandToastOnLower(
  toast: HandToast | null,
  loweredParticipantId: string
): HandToast | null {
  if (toast && toast.participant_id === loweredParticipantId) {
    return null;
  }
  return toast;
}

/** Nova lista da sala (`participants-update`): o aluno do aviso saiu ou está de mão abaixada. */
export function clearHandToastOnParticipants(
  toast: HandToast | null,
  participants: HandToastParticipant[]
): HandToast | null {
  if (!toast) {
    return toast;
  }
  const current = participants.find((p) => p.participant_id === toast.participant_id);
  if (!current || !current.hand_raised) {
    return null;
  }
  return toast;
}
