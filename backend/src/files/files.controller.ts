// src/files/files.controller.ts

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CreateFileDto } from './dto/create-file.dto';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { NotFoundException } from '@nestjs/common';

@Controller('files')
export default class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const filename = `${Date.now()}-${file.originalname}`;
          cb(null, filename);
        },
      }),
    }),
  )
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() createFileDto: CreateFileDto,
  ) {
    return this.filesService.create({
      title: createFileDto.title,
      uploader: createFileDto.uploader,
      filename: file.filename,
      originalname: file.originalname,
    });
  }

  @Get()
  getAllFiles() {
    return this.filesService.findAll();
  }
  @Get(':id/download')
  async downloadFile(@Param('id') id: string, @Res() res: Response) {
    const file = await this.filesService.findOne(Number(id));
    if (!file) return res.status(404).send('File not found');

    const filePath = path.join(__dirname, '../../uploads', file.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    return res.download(filePath, file.originalname);
  }

  @Get(':id')
  async getFile(@Param('id') id: string) {
    const file = await this.filesService.findOne(Number(id));
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }
}
