// backend/src/dataroom/dataroom.controller.ts

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { assertMaster } from '../common/utils/role.util';
import { DataroomService } from './dataroom.service';
import { CreateDataroomDto } from './dto/create-dataroom.dto';
import { Dataroom } from './entities/dataroom.entity';

@ApiTags('dataroom')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dataroom')
export class DataroomController {
  constructor(private readonly dataroomService: DataroomService) {}

  @Post()
  async create(
    @Body() createDataroomDto: CreateDataroomDto,
    @CurrentUser() currentUser: JwtUser,
  ): Promise<Dataroom> {
    assertMaster(currentUser, '자료 업로드');

    return this.dataroomService.create({
      ...createDataroomDto,
      uploader: currentUser.displayName,
    });
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
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtUser,
  ): Promise<{ message: string }> {
    assertMaster(currentUser, '자료 삭제');
    const deleted = await this.dataroomService.remove(Number(id));
    if (!deleted) {
      return { message: `Dataroom with ID ${id} not found` };
    }
    return { message: `Dataroom with ID ${id} deleted successfully` };
  }
}
