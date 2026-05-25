export interface CreateCaseRequest {
  readonly name: string;
  readonly country: string;
  readonly language: string;
  readonly contactMethod: 'email' | 'telegram' | 'phone';
  readonly contactValue: string;
  readonly topic: string;
  readonly message: string;
  readonly consentData: boolean;
  readonly consentSensitive: boolean;
}

export interface CreateCaseResponse {
  readonly id: string;
  readonly status: string;
}
