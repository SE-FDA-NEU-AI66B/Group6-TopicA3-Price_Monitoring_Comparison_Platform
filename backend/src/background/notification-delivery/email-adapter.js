export class EmailDeliveryError extends Error {
  constructor(failureReason) {
    super(failureReason);
    this.name = 'EmailDeliveryError';
    this.failureReason = failureReason;
  }
}

export function requireEmailAdapter(emailAdapter) {
  if (!emailAdapter || typeof emailAdapter.sendEmail !== 'function') {
    throw new TypeError('emailAdapter must provide an async sendEmail function.');
  }

  return emailAdapter;
}
