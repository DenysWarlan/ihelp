import { Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the person (beneficiary) cabinet (/person/*).
 * Covers the main dashboard, courses, lessons, chat, meetings, and profile.
 */
export class PersonCabinetPage extends BasePage {
  // ---------------------------------------------------------------------------
  // Locators — Navigation
  // ---------------------------------------------------------------------------

  get navbar(): Locator {
    return this.page.locator('[data-testid="person-nav"], nav, header');
  }

  get coursesLink(): Locator {
    return this.page.getByRole('link', { name: /курси|courses/i });
  }

  get chatLink(): Locator {
    return this.page.getByRole('link', { name: /чат|chat|повідомлення/i });
  }

  get meetingsLink(): Locator {
    return this.page.getByRole('link', { name: /зустрічі|meetings/i });
  }

  get profileLink(): Locator {
    return this.page.getByRole('link', { name: /профіль|profile/i });
  }

  // ---------------------------------------------------------------------------
  // Locators — Dashboard (/person)
  // ---------------------------------------------------------------------------

  get welcomeMessage(): Locator {
    return this.page.locator('[data-testid="welcome-message"], h1, .welcome');
  }

  get activeCaseCard(): Locator {
    return this.page.locator('[data-testid="active-case"], .case-card');
  }

  get progressOverview(): Locator {
    return this.page.locator('[data-testid="progress-overview"], .progress');
  }

  // ---------------------------------------------------------------------------
  // Locators — Courses (/person/courses)
  // ---------------------------------------------------------------------------

  get courseCards(): Locator {
    return this.page.locator('[data-testid="course-card"], .course-card, .course-item');
  }

  get courseTitle(): Locator {
    return this.page.locator('[data-testid="course-title"], h1, h2').first();
  }

  get courseProgress(): Locator {
    return this.page.locator('[data-testid="course-progress"], .progress-bar, progress');
  }

  // ---------------------------------------------------------------------------
  // Locators — Lesson (/person/courses/:courseId/lessons/:lessonId)
  // ---------------------------------------------------------------------------

  get lessonContent(): Locator {
    return this.page.locator('[data-testid="lesson-content"], .lesson-content, article');
  }

  get lessonTitle(): Locator {
    return this.page.locator('[data-testid="lesson-title"], h1').first();
  }

  get nextLessonButton(): Locator {
    return this.page.getByRole('button', { name: /наступний|next|далі/i });
  }

  get previousLessonButton(): Locator {
    return this.page.getByRole('button', { name: /попередній|previous|назад/i });
  }

  get completeLessonButton(): Locator {
    return this.page.getByRole('button', { name: /завершити|complete|готово/i });
  }

  // ---------------------------------------------------------------------------
  // Locators — Chat (/person/chat)
  // ---------------------------------------------------------------------------

  get chatMessageList(): Locator {
    return this.page.locator('[data-testid="message-list"], .message-list, .chat-messages');
  }

  get chatInput(): Locator {
    return this.page.getByPlaceholder(/повідомлення|message|напишіть/i);
  }

  get chatSendButton(): Locator {
    return this.page.getByRole('button', { name: /надіслати|send/i });
  }

  // ---------------------------------------------------------------------------
  // Locators — Profile (/person/profile)
  // ---------------------------------------------------------------------------

  get profileNameInput(): Locator {
    return this.page.getByLabel(/ім'я|name/i);
  }

  get profileEmailField(): Locator {
    return this.page.getByLabel(/email|електронна пошта/i);
  }

  get saveProfileButton(): Locator {
    return this.page.getByRole('button', { name: /зберегти|save/i });
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async open(): Promise<void> {
    await this.navigateTo('/person');
  }

  async openCourses(): Promise<void> {
    await this.navigateTo('/person/courses');
  }

  async openCourse(index: number): Promise<void> {
    await this.courseCards.nth(index).click();
  }

  async openChat(): Promise<void> {
    await this.navigateTo('/person/chat');
  }

  async sendChatMessage(text: string): Promise<void> {
    await this.chatInput.fill(text);
    await this.chatSendButton.click();
  }

  async openProfile(): Promise<void> {
    await this.navigateTo('/person/profile');
  }

  async openMeetings(): Promise<void> {
    await this.navigateTo('/person/meetings');
  }

  async completeLesson(): Promise<void> {
    await this.completeLessonButton.click();
  }

  async goToNextLesson(): Promise<void> {
    await this.nextLessonButton.click();
  }
}
