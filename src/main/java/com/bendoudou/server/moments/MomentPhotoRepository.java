package com.bendoudou.server.moments;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MomentPhotoRepository extends JpaRepository<MomentPhoto, Long> {

    Page<MomentPhoto> findAllByOrderBySortOrderDescIdDesc(Pageable pageable);

    Page<MomentPhoto> findAllByOrderByDominantHueAscIdDesc(Pageable pageable);

    @Query("select coalesce(max(m.sortOrder), 0) from MomentPhoto m")
    long findMaxSortOrder();

    boolean existsByObjectKey(String objectKey);

    @Query("""
            select m from MomentPhoto m
            where m.dominantHue is not null
              and (
                (:lo <= :hi and m.dominantHue between :lo and :hi)
                or (:lo > :hi and (m.dominantHue >= :lo or m.dominantHue <= :hi))
              )
              and (:minSat is null or m.dominantSat >= :minSat)
              and (:maxSat is null or m.dominantSat <= :maxSat)
            order by m.sortOrder desc, m.id desc
            """)
    Page<MomentPhoto> findByHueRange(
            @Param("lo") int lo,
            @Param("hi") int hi,
            @Param("minSat") Integer minSat,
            @Param("maxSat") Integer maxSat,
            Pageable pageable
    );

    @Query("""
            select m from MomentPhoto m
            where m.dominantHue is not null
              and (
                (:lo <= :hi and m.dominantHue between :lo and :hi)
                or (:lo > :hi and (m.dominantHue >= :lo or m.dominantHue <= :hi))
              )
              and (:minSat is null or m.dominantSat >= :minSat)
              and (:maxSat is null or m.dominantSat <= :maxSat)
            order by m.dominantHue asc, m.id desc
            """)
    Page<MomentPhoto> findByHueRangeOrderByHue(
            @Param("lo") int lo,
            @Param("hi") int hi,
            @Param("minSat") Integer minSat,
            @Param("maxSat") Integer maxSat,
            Pageable pageable
    );

    @Query("""
            select m from MomentPhoto m
            where (m.dominantHue is null or m.dominantSat is null or m.dominantSat <= :maxSat)
            order by m.sortOrder desc, m.id desc
            """)
    Page<MomentPhoto> findNeutral(@Param("maxSat") int maxSat, Pageable pageable);

    @Query("""
            select m from MomentPhoto m
            where m.dominantSat is not null and m.dominantSat >= :minSat
            order by m.sortOrder desc, m.id desc
            """)
    Page<MomentPhoto> findVivid(@Param("minSat") int minSat, Pageable pageable);

    @Query("""
            select m from MomentPhoto m
            where m.dominantSat is not null and m.dominantSat >= :minSat
            order by m.dominantHue asc, m.id desc
            """)
    Page<MomentPhoto> findVividOrderByHue(@Param("minSat") int minSat, Pageable pageable);

    @Query("""
            select m from MomentPhoto m
            where m.dominantSat is not null and m.dominantSat between :minSat and :maxSat
            order by m.sortOrder desc, m.id desc
            """)
    Page<MomentPhoto> findSoft(@Param("minSat") int minSat, @Param("maxSat") int maxSat, Pageable pageable);

    /**
     * 主色分桶统计。bucket=-1 为中性/低饱和；其余为 FLOOR(hue/30)*30。
     * 返回 [bucket, count]。
     */
    @Query(value = """
            SELECT CASE
                     WHEN dominant_hue IS NULL OR dominant_sat IS NULL OR dominant_sat <= 12 THEN -1
                     ELSE FLOOR(dominant_hue / 30) * 30
                   END AS bucket,
                   COUNT(*) AS cnt
            FROM moment_photos
            GROUP BY bucket
            ORDER BY bucket
            """, nativeQuery = true)
    List<Object[]> countColorBuckets();
}
