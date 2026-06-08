import { Module } from '@nestjs/common';
import { ClaudeService } from './claude.service';
import { ProfileSummarizerService } from './profile-summarizer.service';

@Module({
  providers: [ClaudeService, ProfileSummarizerService],
  exports: [ClaudeService, ProfileSummarizerService],
})
export class AiModule {}
