import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Http, INDICES } from './http';
import { fromEvent, map, Observable } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

function isVisible(element: Element): boolean {
  const windowHeight = window.innerHeight;
  const boundedRect = element.getBoundingClientRect();
  const threshold = 1;
  // console.log({ windowHeight, boundedRect });
  return (
    boundedRect.top >= 0 - threshold &&
    boundedRect.bottom <= windowHeight + threshold
  );
}

@Component({
  selector: 'app-root',
  template: `
    @for (elem of query.data(); track elem.path + elem.index) {
      <div #top class="h-4 my-1 w-full bg-gray-300 text-black">
        {{ elem.index }}: {{ elem.path }}
      </div>
    }
    <div #bot class="h-4 w-full bg-red-300 text-black"></div>
  `,
})
export class App {
  http = inject(Http);

  bot = viewChild.required<ElementRef>('bot');

  onScroll = toSignal(fromEvent(window, 'scroll'), { equal: () => false });

  query = useInfiniteQuery({
    initialPageParam: INDICES[0],
    queryFn: ({ pageParam }) =>
      this.http
        .search(pageParam, 'C')
        .pipe(
          map((matches) => matches.map((path) => ({ path, index: pageParam }))),
        ),
    getNextPageParam: (prevPageParam) => {
      const index = INDICES.indexOf(prevPageParam);
      const next = INDICES[index + 1];
      console.log('getNextPageParam', { prevPageParam, next });
      return next;
    },
  });

  constructor() {
    effect(() => {
      const bot = this.bot().nativeElement;

      // deps
      // this.query.data();
      this.onScroll();

      // if (isVisible(top) && this.query.hasPreviousPage()) {
      //   this.query.fetchPreviousPage();
      //   return;
      // }

      if (isVisible(bot) && this.query.hasNextPage()) {
        this.query.fetchNextPage();
        return;
      }
    });
    // onViewPort(this.top, (isInViewPort) => {
    //   console.log('top', isInViewPort);
    //   if (isInViewPort && this.query.hasPreviousPage()) {
    //     this.query.hasPreviousPage();
    //   }
    // });
    // onViewPort(this.bot, (isInViewPort) => {
    //   console.log('bot', isInViewPort);
    //   if (isInViewPort && this.query.hasNextPage()) {
    //     this.query.fetchNextPage();
    //   }
    // });
  }
}

function useInfiniteQuery<TData, TPageParam extends NonNullable<any>>({
  queryFn: query,
  initialPageParam,
  getNextPageParam,
}: {
  queryFn: (args: { pageParam: NoInfer<TPageParam> }) => Observable<TData[]>;
  initialPageParam: TPageParam;
  getNextPageParam: (
    prevPageParam: NoInfer<TPageParam>,
  ) => NoInfer<TPageParam> | undefined;
}) {
  const END = Symbol('END');
  const isError = signal(false);
  const isLoading = signal(true);
  const data = signal<TData[]>([], { equal: () => false });
  const pageParam = signal<TPageParam | typeof END>(initialPageParam);
  const fetchNextPage = (ignoreLoading: boolean) => {
    if (!ignoreLoading && untracked(isLoading)) {
      return;
    }
    const param = untracked(pageParam);
    if (param !== END) {
      pageParam.set(getNextPageParam(param) ?? END);
    }
  };
  const destroyRef = inject(DestroyRef);

  effect((onCleanup) => {
    const param = pageParam();
    if (param !== END) {
      isLoading.set(true);
      const sub = query({ pageParam: param })
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe((res) => {
          if (res.length === 0) {
            fetchNextPage(true);
            return;
          }
          isLoading.set(false);
          data.update((prev) => {
            prev.push(...res);
            return prev;
          });
        });
      onCleanup(() => sub.unsubscribe());
    } else {
      isLoading.set(false);
    }
  });

  return {
    isError: isError.asReadonly(),
    isFetching: isLoading.asReadonly(),
    isFetchingNextPage: computed(() => isLoading()),
    data: data.asReadonly(),
    fetchNextPage: () => fetchNextPage(false),
    hasNextPage: computed(() => pageParam() !== END),
  };
}
