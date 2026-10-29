import { Type } from 'class-transformer';
import { ArrayMaxSize, Equals, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LABEL_LANGUAGES, PRODUCT_TYPES, type ProductType } from '@rfda/shared';

export class CreateApplicationDto {
  @IsIn(PRODUCT_TYPES) type: ProductType;
  @IsString() @IsNotEmpty() @MaxLength(200) category: string;
  @IsIn(['Single product', 'Product family']) submissionType: string;
}

const S = () => (target: object, key: string) => { IsOptional()(target, key); IsString()(target, key); MaxLength(4000)(target, key); };

/** Draft autosave. Every field is optional; only the ones sent are changed. */
export class UpdateApplicationDto {
  @S() category?: string;
  @S() submissionType?: string;
  @S() brand?: string;
  @S() generic?: string;
  @S() form?: string;
  @S() size?: string;
  @S() intendedUse?: string;
  @S() intendedUsers?: string;
  @S() storage?: string;
  @S() shelfLife?: string;
  @S() description?: string;
  @S() warnings?: string;
  @S() mfrName?: string;
  @S() mfrCountry?: string;
  @S() mfrAddress?: string;
  @S() origin?: string;
  @S() srA?: string;
  @S() refAuthority?: string;
  @S() ltr?: string;
  @IsOptional() @IsBoolean() trademarkDiffers?: boolean;
  @IsOptional() @IsString() @MaxLength(20000) labelText?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsIn(LABEL_LANGUAGES, { each: true }) labelLanguages?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(4) step?: number;
}

export class SubmitDto {
  @Equals(true, { message: 'Tick the declaration to submit.' }) declaration: boolean;
}

export class QueryReplyDto {
  @IsString() @IsNotEmpty({ message: 'Write a response.' }) @MaxLength(20000) text: string;
}
