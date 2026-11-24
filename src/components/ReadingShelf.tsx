import {shelfBookStyle,shelfBooks,type RamBook,type RamBookId} from '../reading-books';
import {bookSpine} from '../reading-spines';
import './ReadingShelf.css';

export function ReadingShelfSpines({ books, onRead }: { books: readonly RamBook[]; onRead?: (id: RamBookId) => void }) {
  return books.map((book, index) => {
    const {title, art, hue} = bookSpine(book);
    const style = shelfBookStyle(index, Boolean(art));
    const spine = <span className={`reading-shelf-spine ${art ? 'reading-shelf-spine--illustrated' : 'reading-shelf-spine--gazette'}`}
      aria-hidden="true">
      {art && <img className="reading-shelf-spine-art" src={art} alt="" draggable={false}
        style={hue ? {filter: `hue-rotate(${hue}deg)`} : undefined}/>}
      <span className="reading-shelf-spine-title">
        {Array.from(title).map((character, letter) => <span key={letter}>{character}</span>)}
      </span>
    </span>;
    return onRead ? (
      <button key={book.id} type="button" className="reading-shelf-slot room-shelf-book-hit" data-room-interactive="true"
        aria-label={`阅读《${book.title}》`} title={book.title} style={style} onClick={() => onRead(book.id)}>
        {spine}
      </button>
    ) : <span key={book.id} className="reading-shelf-slot" style={style}>{spine}</span>;
  });
}

export function ReadingShelfArt({ page = 0, showBooks = true }: { page?: number; showBooks?: boolean }) {
  return <span className="reading-shelf-art furniture-art-crop" aria-hidden="true">
    <img className="reading-shelf-frame" src="./assets/original/reading-books/shelf.svg" alt="" draggable={false}/>
    {showBooks && <ReadingShelfSpines books={shelfBooks(page)}/>}
  </span>;
}
