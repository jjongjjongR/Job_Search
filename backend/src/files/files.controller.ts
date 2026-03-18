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
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CreateFileDto } from './dto/create-file.dto';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { assertMaster } from '../common/utils/role.util';
import {
  createDownloadDisposition,
  normalizeOriginalName,
  sanitizeStoredFilename,
} from './utils/file-name.util';

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.zip',
  '.hwp',
  '.hwpx',
];

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export default class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
      fileFilter: (_req, file, callback) => {
        const extension = path
          .extname(normalizeOriginalName(file.originalname))
          .toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(extension)) {
          callback(
            new BadRequestException('허용되지 않은 파일 형식입니다.'),
            false,
          );
          return;
        }

        callback(null, true);
      },
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const filename = `${Date.now()}-${sanitizeStoredFilename(file.originalname)}`;
          cb(null, filename);
        },
      }),
    }),
  )
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() createFileDto: CreateFileDto,
    @CurrentUser() currentUser: JwtUser,
  ) {
    assertMaster(currentUser, '파일 업로드');

    if (!file) {
      throw new BadRequestException('업로드할 파일이 필요합니다.');
    }

    return this.filesService.create({
      title: createFileDto.title,
      uploader: currentUser.displayName,
      filename: file.filename,
      originalname: normalizeOriginalName(file.originalname),
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

    const downloadName = normalizeOriginalName(file.originalname);
    res.setHeader('Content-Disposition', createDownloadDisposition(downloadName));
    res.setHeader('X-File-Name', encodeURIComponent(downloadName));

    return res.sendFile(filePath);
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
