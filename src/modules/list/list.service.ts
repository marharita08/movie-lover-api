import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { List } from 'src/entities/list.entity';
import { ILike, Repository } from 'typeorm';

import { FileService } from '../file/file.service';
import { CreateListDto, GetListsQueryDto, UpdateListDto } from './dto';

@Injectable()
export class ListService {
  constructor(
    @InjectRepository(List)
    private readonly listRepository: Repository<List>,
    private readonly fileService: FileService,
  ) {}

  async create(dto: CreateListDto, userId: string) {
    const file = await this.fileService.findOne(dto.fileId);

    if (!file || file.userId !== userId) {
      throw new ForbiddenException('File not found or access denied');
    }

    const list = this.listRepository.create({
      name: dto.name,
      fileId: dto.fileId,
      userId,
    });

    return this.listRepository.save(list);
  }

  async findAll(
    query: GetListsQueryDto,
    userId: string,
  ): Promise<{
    results: List[];
    totalPages: number;
    page: number;
    totalResults: number;
  }> {
    const { name, page = 1, limit = 10 } = query;

    const where: any = { userId };
    if (name) {
      where.name = ILike(`%${name}%`);
    }

    const [data, total] = await this.listRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      results: data,
      totalPages: Math.ceil(total / limit),
      page,
      totalResults: total,
    };
  }

  async findOne(id: string, userId: string): Promise<List> {
    const list = await this.listRepository.findOne({
      where: { id, userId },
    });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    return list;
  }

  async update(id: string, dto: UpdateListDto, userId: string): Promise<List> {
    const list = await this.findOne(id, userId);

    if (dto.fileId && dto.fileId !== list.fileId) {
      const file = await this.fileService.findOne(dto.fileId);
      if (!file || file.userId !== userId) {
        throw new ForbiddenException('File not found or access denied');
      }
    }

    Object.assign(list, dto);
    return this.listRepository.save(list);
  }

  async delete(id: string, userId: string): Promise<void> {
    const list = await this.findOne(id, userId);
    await this.listRepository.remove(list);
  }
}
