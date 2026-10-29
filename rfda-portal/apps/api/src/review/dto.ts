import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { DecisionAction } from '@rfda/shared';

const ACTIONS: DecisionAction[] = ['pay-ok', 'pay-bad', 'accept', 'query', 'rec-approve', 'rec-reject', 'approve', 'return', 'reject'];

export class DecisionDto {
  @IsIn(ACTIONS) action: DecisionAction;
  @IsOptional() @IsString() @MaxLength(20000) comment?: string;
  @IsOptional() @IsString() @MaxLength(50000) findings?: string;
}

export class CheckDto {
  @IsBoolean() checked: boolean;
}
