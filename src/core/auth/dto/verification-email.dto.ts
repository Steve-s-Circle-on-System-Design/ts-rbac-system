import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SendVerificationEmailPayload {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as string),
  )
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  token!: string;
}
