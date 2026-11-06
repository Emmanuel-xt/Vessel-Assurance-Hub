import "fake-indexeddb/auto";
import { configureDemoFixtures } from "@/lib/data/mock/store";

// Tests start from the base fixtures without the ~300 generated assessments (history tests opt back in).
configureDemoFixtures({ history: false });
