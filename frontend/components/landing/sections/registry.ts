import type { ComponentType } from 'react';
import type { SectionProps } from '../types';
import HeroSection from './HeroSection';
import AboutSection from './AboutSection';
import CourseSection from './CourseSection';
import ScheduleSection from './ScheduleSection';
import PricingSection from './PricingSection';
import ResultsEmbedSection from './ResultsEmbedSection';
import PhotosEmbedSection from './PhotosEmbedSection';
import GallerySection from './GallerySection';
import SponsorsSection from './SponsorsSection';
import ContactSocialSection from './ContactSocialSection';

/** FEATURE-083 — section type → premium component (renderer dispatch). */
export const SECTION_COMPONENTS: Record<string, ComponentType<SectionProps>> = {
  hero: HeroSection,
  about: AboutSection,
  course: CourseSection,
  schedule: ScheduleSection,
  pricing: PricingSection,
  results_embed: ResultsEmbedSection,
  photos_embed: PhotosEmbedSection,
  gallery: GallerySection,
  sponsors: SponsorsSection,
  contact_social: ContactSocialSection,
};
