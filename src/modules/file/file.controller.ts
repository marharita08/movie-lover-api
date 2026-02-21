import {
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { GetUser } from 'src/modules/auth/decorators';

import { CsvFileValidator } from './csv-file.validator';
import { FileService } from './file.service';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new CsvFileValidator()],
      }),
    )
    file: Express.Multer.File,
    @GetUser('id') userId: string,
  ) {
    return this.fileService.upload(file, userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.fileService.findOne(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.fileService.delete(id);
  }
}
