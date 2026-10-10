import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, Equals, IsArray, IsBoolean, IsDefined, IsEmail, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
export const SKUS = ["CBST-300", "CBST-400", "CBST-600"];
export class CustomerDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 100 }) @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @ApiProperty({ type: String, example: "0912345678" }) @Matches(/^(?:0|\+84)[35789]\d{8}$/) phone!: string;
  @ApiProperty({ type: String, minLength: 5, maxLength: 500 }) @IsString() @MinLength(5) @MaxLength(500) address!: string;
  @ApiProperty({ type: String, maxLength: 100 }) @IsString() @MinLength(1) @MaxLength(100) area!: string;
}
export class ItemDto {
  @ApiProperty({ enum: SKUS }) @IsIn(SKUS) sku!: string;
  @ApiProperty({ type: Number, minimum: 1, maximum: 100 }) @IsInt() @Min(1) @Max(100) qty!: number;
}
export class CheckoutDto {
  @ApiProperty({ type: CustomerDto }) @IsDefined() @ValidateNested() @Type(() => CustomerDto) customer!: CustomerDto;
  @ApiProperty({ type: [ItemDto], minItems: 1, maxItems: 3 }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @ArrayUnique((item: ItemDto) => item.sku) @ValidateNested({ each: true }) @Type(() => ItemDto) items!: ItemDto[];
  @ApiProperty({ type: Boolean, enum: [true] }) @Equals(true) consent!: boolean;
  @ApiProperty({ enum: ["WEBSITE", "FACEBOOK_GROUP", "DIRECT", "OTHER"] }) @IsIn(["WEBSITE", "FACEBOOK_GROUP", "DIRECT", "OTHER"]) source!: string;
  @ApiPropertyOptional({ type: String, maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
export class LoginDto {
  @ApiProperty({ type: String, format: "email", maxLength: 254 }) @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({ type: String, writeOnly: true, maxLength: 128 }) @IsString() @MinLength(1) @MaxLength(128) password!: string;
}
export class CreateUserDto extends LoginDto {
  @MinLength(12) declare password: string;
  @IsString() @MinLength(1) @MaxLength(100) displayName!: string;
}
export class UserStatusDto { @IsIn(["ACTIVE", "INACTIVE"]) status!: "ACTIVE" | "INACTIVE"; }
export class VersionDto { @ApiProperty({ type: Number, minimum: 0, maximum: 2147483647 }) @IsInt() @Min(0) @Max(2147483647) expectedVersion!: number; }
export class TransitionDto extends VersionDto {
  @IsIn(["CONFIRMED", "PACKING", "SHIPPING", "DELIVERED", "CANCELLED", "DELIVERY_FAILED", "RETURN_REQUESTED", "PARTIALLY_RETURNED", "RETURNED"]) status!: import("../domain").OrderStatus;
  @IsString() @MinLength(1) @MaxLength(300) reason!: string;
}
export class PaymentDto extends VersionDto {
  @IsInt() @Min(1) @Max(1000000000) amountVnd!: number;
  @IsIn(["CASH", "BANK_TRANSFER", "COD_SETTLEMENT"]) method!: string;
}
export class RefundDto extends PaymentDto {
  @IsString() @MinLength(1) @MaxLength(300) reason!: string;
  @ApiPropertyOptional({ enum: ["RETURN", "GOODWILL"], default: "GOODWILL" }) @IsOptional() @IsIn(["RETURN", "GOODWILL"]) purpose?: "RETURN" | "GOODWILL";
}
export class ReceiptDto {
  @IsIn(SKUS) sku!: string;
  @IsString() @MinLength(1) @MaxLength(100) lotCode!: string;
  @IsInt() @Min(1) @Max(100000) qty!: number;
  @IsInt() @Min(0) @Max(10000000) landedUnitCostVnd!: number;
  @IsISO8601({ strict: true }) receivedAt!: string;
  @IsOptional() @IsISO8601({ strict: true }) expiresAt?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(500) labelReference?: string;
}
export class AdjustmentDto {
  @IsUUID() batchId!: string;
  @IsInt() @Min(-100000) @Max(100000) qtyDelta!: number;
  @IsString() @MinLength(1) @MaxLength(300) reason!: string;
}
export class ExpenseDto {
  @IsIn(["ORDER", "OVERHEAD"]) scope!: "ORDER" | "OVERHEAD";
  @IsOptional() @IsUUID() orderId?: string;
  @IsOptional() @IsInt() @Min(0) expectedVersion?: number;
  @IsInt() @Min(1) @Max(1000000000) amountVnd!: number;
  @IsIn(["SHIPPING", "PACKAGING", "MARKETING", "OTHER"]) category!: string;
  @IsString() @MinLength(1) @MaxLength(300) reason!: string;
}
export class CostsDto extends VersionDto { @IsBoolean() @Equals(true) finalized!: boolean; }
export class PayoutDto {
  @IsUUID() memberId!: string;
  @IsString() @MinLength(1) @MaxLength(100) reference!: string;
}
export class ProductDto extends VersionDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 10000000 }) @IsInt() @Min(1) @Max(10000000) retailPriceVnd!: number;
  @ApiProperty({ type: Boolean }) @IsBoolean() active!: boolean;
  @ApiPropertyOptional({ type: String, maxLength: 150 }) @IsOptional() @IsString() @Matches(/\S/) @MaxLength(150) name?: string;
}
export class CreateProductDto {
  @ApiProperty({ enum: SKUS }) @IsIn(SKUS) sku!: string;
  @ApiProperty({ type: String, maxLength: 150 }) @IsString() @Matches(/\S/) @MaxLength(150) name!: string;
  @ApiProperty({ type: Number, minimum: 1, maximum: 10000000 }) @IsInt() @Min(1) @Max(10000000) retailPriceVnd!: number;
  @ApiProperty({ type: Boolean }) @IsBoolean() active!: boolean;
}
export class PageDto {
  @IsOptional() @Matches(/^\d{1,6}$/) page?: string;
  @IsOptional() @Matches(/^(?:[1-9]|[1-9]\d|100)$/) limit?: string;
}
export class ResetPasswordDto {
  @ApiProperty({ type: String, minLength: 43, maxLength: 43, writeOnly: true }) @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
  @ApiProperty({ type: String, minLength: 12, maxLength: 128, writeOnly: true }) @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
export class AssignOrderDto extends VersionDto {
  @ApiProperty({ type: String, format: "uuid" }) @IsUUID() memberId!: string;
  @ApiProperty({ type: String, maxLength: 300 }) @IsString() @MinLength(1) @MaxLength(300) reason!: string;
}
export class EditOrderDto extends VersionDto {
  @ApiProperty({ type: [ItemDto], minItems: 1, maxItems: 3 }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @ArrayUnique((item: ItemDto) => item.sku) @ValidateNested({ each: true }) @Type(() => ItemDto) items!: ItemDto[];
  @ApiPropertyOptional({ type: CustomerDto }) @IsOptional() @ValidateNested() @Type(() => CustomerDto) customer?: CustomerDto;
  @ApiProperty({ type: String, maxLength: 300 }) @IsString() @MinLength(1) @MaxLength(300) reason!: string;
}
export class ReturnLineDto {
  @ApiProperty({ type: String, format: "uuid" }) @IsUUID() batchId!: string;
  @ApiProperty({ type: Number, minimum: 1, maximum: 100 }) @IsInt() @Min(1) @Max(100) qty!: number;
  @ApiProperty({ enum: ["RESTOCK", "DISCARD"] }) @IsIn(["RESTOCK", "DISCARD"]) disposition!: "RESTOCK" | "DISCARD";
}
export class ReturnDto extends VersionDto {
  @ApiProperty({ type: [ReturnLineDto], minItems: 1, maxItems: 300 }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(300) @ArrayUnique((line: ReturnLineDto) => line.batchId) @ValidateNested({ each: true }) @Type(() => ReturnLineDto) lines!: ReturnLineDto[];
  @ApiProperty({ type: String, maxLength: 300 }) @IsString() @MinLength(1) @MaxLength(300) reason!: string;
  @ApiProperty({ type: String, maxLength: 500 }) @IsString() @MinLength(1) @MaxLength(500) inspectionReference!: string;
}
