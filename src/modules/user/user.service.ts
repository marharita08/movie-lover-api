import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';

import { TranslationKeys } from 'src/const/translations/keys';
import { User } from 'src/entities';
import { FileService } from 'src/modules/file/file.service';

import { CreateUserDto, UpdateUserDto, UserDto } from './dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly fileService: FileService,
    private readonly i18n: I18nService,
  ) {}

  async getById(id: string): Promise<UserDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(
        this.i18n.t(TranslationKeys.ERROR_USER_NOT_FOUND),
      );
    }
    return this.excludePrivateFields(user);
  }

  async getByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { googleId } });
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async getByEmailOrThrow(email: string): Promise<User> {
    const user = await this.getByEmail(email);
    if (!user) {
      throw new NotFoundException(
        this.i18n.t(TranslationKeys.ERROR_USER_NOT_FOUND),
      );
    }
    return user;
  }

  excludePrivateFields(user: User): UserDto {
    const { passwordHash: _, ...userData } = user;
    return userData;
  }

  async create(createUserDto: CreateUserDto): Promise<UserDto> {
    const user = this.userRepository.create(createUserDto);
    await user.save();
    return this.excludePrivateFields(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(
        this.i18n.t(TranslationKeys.ERROR_USER_NOT_FOUND),
      );
    }
    Object.assign(user, updateUserDto);
    await user.save();
    return this.excludePrivateFields(user);
  }

  async delete(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(
        this.i18n.t(TranslationKeys.ERROR_USER_NOT_FOUND),
      );
    }
    await this.fileService.deleteByUserId(id);
    await this.userRepository.remove(user);
  }
}
