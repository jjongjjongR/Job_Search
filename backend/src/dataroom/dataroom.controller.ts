// backend/src/dataroom/dataroom.controller.ts

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataroomService } from './dataroom.service';
import { CreateDataroomDto } from './dto/create-dataroom.dto';
import { Dataroom } from './entities/dataroom.entity';
import { FilesService } from 'src/files/files.service';

@Controller('dataroom')
export class DataroomController {
  constructor(
    private readonly dataroomService: DataroomService,
    private readonly filesService: FilesService,
  ) {}

  @Post()
  async create(
    @Body() createDataroomDto: CreateDataroomDto,
  ): Promise<Dataroom> {
    return this.dataroomService.create(createDataroomDto);
  }

  @Get()
  async findAll(): Promise<Dataroom[]> {
    return this.dataroomService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Dataroom> {
    console.log('요청 들어옴: /dataroom/' + id);
    return this.dataroomService.findOne(Number(id));
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    try {
      const deleted = await this.dataroomService.remove(Number(id));
      if (!deleted) {
        return { message: `Dataroom with ID ${id} not found` };
      }
      return { message: `Dataroom with ID ${id} deleted successfully` };
    } catch (error) {
      console.error('Error deleting dataroom:', error);
      throw new InternalServerErrorException(
        '삭제 중 서버 오류가 발생했습니다.',
      );
    }
  }
}
