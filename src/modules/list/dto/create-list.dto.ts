import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateListDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @IsUUID()
  fileId: string;
}
