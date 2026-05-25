import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { LucideAngularModule, icons } from 'lucide-angular';
import type { LucideIconData, LucideIcons } from 'lucide-angular';

/**
 * Shared icon wrapper around lucide-angular.
 *
 * Usage:
 *   <ui-icon name="Home" />
 *   <ui-icon name="Settings" [size]="20" color="var(--ihelp-accent)" />
 *
 * The `name` input should be the PascalCase icon name as exported by lucide-angular
 * (e.g. "Home", "ArrowRight", "HeartHandshake").
 */
@Component({
  selector: 'ui-icon',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  /** Lucide icon name in PascalCase (e.g. "ArrowRight", "Home") */
  readonly name = input.required<string>();

  /** Icon size in pixels */
  readonly size = input<number>(24);

  /** Icon color — uses design token by default */
  readonly color = input<string>('var(--ihelp-text-primary)');

  /** Stroke width */
  readonly strokeWidth = input<number>(2);

  /**
   * Resolve the icon name string to the actual Lucide icon data.
   */
  protected readonly resolvedIcon = computed<LucideIconData>(() => {
    const iconName = this.name();
    const allIcons = icons as unknown as LucideIcons;
    // Try direct PascalCase lookup first
    if (allIcons[iconName]) {
      return allIcons[iconName];
    }
    // Try converting kebab-case to PascalCase: "arrow-right" -> "ArrowRight"
    const pascalName = iconName
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    return allIcons[pascalName] ?? allIcons['CircleAlert'];
  });
}
