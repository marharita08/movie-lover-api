import { User } from 'src/entities';
import { Repository } from 'typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserDto } from './dto/user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getById(id: string): Promise<UserDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.excludePrivateFields(user);
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async getByEmailOrThrow(email: string): Promise<User> {
    const user = await this.getByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
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
      throw new NotFoundException('User not found');
    }
    Object.assign(user, updateUserDto);
    await user.save();
    return this.excludePrivateFields(user);
  }

  async delete(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.remove(user);
  }
}
