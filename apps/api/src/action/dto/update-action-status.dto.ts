import { IsIn } from 'class-validator';

export class UpdateActionStatusDto {
  @IsIn(['DONE', 'DISMISSED'])
  status!: 'DONE' | 'DISMISSED';
}
