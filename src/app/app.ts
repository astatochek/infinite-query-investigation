import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Signal,
  signal,
  viewChild,
} from '@angular/core';
import { Http, INDICES } from './http';
import { distinctUntilChanged, fromEvent, map, merge, Observable } from 'rxjs';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

function onViewPort(
  ref: Signal<ElementRef>,
  cb: (isInViewPort: boolean) => void,
): void {
  const scrolled = fromEvent(window, 'scroll');
  const refChanged = toObservable(ref);

  function see(): boolean {
    const windowHeight = window.innerHeight;
    const boundedRect = ref().nativeElement.getBoundingClientRect();
    const threshold = 1;
    // console.log({ windowHeight, boundedRect });
    return (
      boundedRect.top >= 0 - threshold &&
      boundedRect.bottom <= windowHeight + threshold
    );
  }

  merge(scrolled, refChanged)
    .pipe(
      map(() => see()),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    )
    .subscribe(cb);
}

@Component({
  selector: 'app-root',
  template: `
    <div #top class="h-4 w-full bg-red-300 text-black"></div>
    @for (elem of query.data(); track $index) {
      <div #top class="h-4 my-1 w-full bg-gray-300 text-black">{{ elem }}</div>
    }
    <div #bot class="h-4 w-full bg-red-300 text-black"></div>
  `,
})
export class App {
  http = inject(Http);

  top = viewChild.required<ElementRef>('top');
  bot = viewChild.required<ElementRef>('bot');

  query = useInfiniteQuery<string[], number>({
    initialPageParam: INDICES[0],
    maxPages: 3,
    query: ({ pageParam }) => this.http.search(pageParam, 'C'),
    getNextPageParam: (prevPageParam) => {
      const index = INDICES.indexOf(prevPageParam);
      const next = INDICES[index + 1];
      console.log('getNextPageParam', { prevPageParam, next });
      return next;
    },
    getPrevPageParam: (prevPageParam) => {
      const index = INDICES.indexOf(prevPageParam);
      const next = INDICES[index - 1];
      console.log('getPrevPageParam', { prevPageParam, next });
      return next;
    },
  });

  constructor() {
    onViewPort(this.top, (isInViewPort) => {
      console.log('top', isInViewPort);
      if (isInViewPort && this.query.hasPreviousPage()) {
        this.query.hasPreviousPage();
      }
    });
    onViewPort(this.bot, (isInViewPort) => {
      console.log('bot', isInViewPort);
      if (isInViewPort && this.query.hasNextPage()) {
        this.query.fetchNextPage();
      }
    });
  }

  onVisible(v: boolean) {
    console.log(v);
  }
}

function useInfiniteQuery<
  TPage extends any[],
  TPageParam extends NonNullable<any>,
>({
  query,
  initialPageParam,
  maxPages,
  getNextPageParam,
  getPrevPageParam,
}: {
  query: (args: { pageParam: NoInfer<TPageParam> }) => Observable<TPage>;
  initialPageParam: TPageParam;
  maxPages: number;
  getNextPageParam: (
    prevPageParam: NoInfer<TPageParam>,
  ) => NoInfer<TPageParam> | undefined;
  getPrevPageParam: (
    prevPageParam: NoInfer<TPageParam>,
  ) => NoInfer<TPageParam> | undefined;
}) {
  const START = Symbol('START');
  const END = Symbol('END');
  const isError = signal(false);
  const isLoading = signal(true);
  const cache = signal<{ pageParam: TPageParam; page: TPage }[]>([]);
  const data = computed(() => cache().flatMap((e) => e.page));
  const pageParam = signal<TPageParam | typeof START | typeof END>(
    initialPageParam,
  );
  let direction: 1 | -1 = 1;

  const destroyRef = inject(DestroyRef);

  effect((onCleanup) => {
    const param = pageParam();
    const dir = direction;
    if (param !== END && param !== START) {
      isLoading.set(true);
      const sub = query({ pageParam: param })
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe((res) => {
          isLoading.set(false);
          if (dir === 1) {
            cache.update((entries) => {
              entries.push({ pageParam: param, page: res });
              if (entries.length > maxPages) {
                entries.shift();
              }
              return [...entries];
            });
          } else if (dir === -1) {
            cache.update((entries) => {
              entries.unshift({ pageParam: param, page: res });
              if (entries.length > maxPages) {
                entries.pop();
              }
              return [...entries];
            });
          }
        });
      onCleanup(() => sub.unsubscribe());
    }
  });

  return {
    isError: isError.asReadonly(),
    isFetching: isLoading.asReadonly(),
    isFetchingNextPage: computed(() => isLoading() && direction === 1),
    isFetchingPreviousPage: computed(() => isLoading() && direction === -1),
    data,
    fetchNextPage: () => {
      direction = 1;
      const param = pageParam();
      const last = cache().at(-1)?.pageParam;
      if (param !== END && last !== undefined) {
        pageParam.set(getNextPageParam(param === START ? last : param) ?? END);
      }
    },
    fetchPreviousPage: () => {
      direction = -1;
      const param = pageParam();
      const first = cache().at(0)?.pageParam;
      if (param !== START && first !== undefined) {
        pageParam.set(getPrevPageParam(param === END ? first : param) ?? START);
      }
    },
    hasNextPage: computed(() => pageParam() !== END),
    hasPreviousPage: computed(() => pageParam() !== START),
  };
}
